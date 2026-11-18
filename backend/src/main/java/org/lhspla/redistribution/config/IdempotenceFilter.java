package org.lhspla.redistribution.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Clés d'idempotence : une requête d'écriture qui porte l'en-tête {@code Idempotency-Key}
 * (un UUID créé par le navigateur pour chaque action) n'est exécutée qu'une fois.
 * Si la même requête revient avec la même clé (double envoi, nouvelle tentative après une
 * coupure réseau), le serveur renvoie la réponse enregistrée sans rien refaire.
 *
 * <ul>
 *   <li>même clé, requête identique, réponse connue → réponse rejouée (en-tête {@code Idempotent-Replayed}) ;</li>
 *   <li>même clé, requête identique encore en cours → 409 ;</li>
 *   <li>même clé réutilisée pour une autre requête → 422 ;</li>
 *   <li>erreur serveur (5xx) → la clé est libérée, on peut réessayer.</li>
 * </ul>
 * Les clés sont propres à chaque utilisateur et conservées 24 heures.
 */
@Slf4j
public class IdempotenceFilter extends OncePerRequestFilter {

    public static final String EN_TETE = "Idempotency-Key";
    private static final Set<String> METHODES = Set.of("POST", "PUT", "DELETE", "PATCH");

    private final JdbcTemplate jdbc;

    public IdempotenceFilter(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Envois de fichiers exclus : leur corps est lu par le conteneur (getParts), pas relisible ici.
        // Les imports sont de toute façon des mises à jour par code, rejouables sans doublon.
        String type = request.getContentType();
        return !METHODES.contains(request.getMethod()) || request.getHeader(EN_TETE) == null
                || (type != null && type.toLowerCase().startsWith("multipart/"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            chain.doFilter(request, response);
            return;
        }

        UUID cle;
        try {
            cle = UUID.fromString(request.getHeader(EN_TETE).trim());
        } catch (IllegalArgumentException e) {
            erreur(response, 400, "BAD_REQUEST", "En-tête Idempotency-Key invalide : un UUID est attendu.");
            return;
        }

        CorpsMemorise requete = new CorpsMemorise(request);
        String utilisateur = auth.getName();
        String chemin = request.getRequestURI() + (request.getQueryString() != null ? "?" + request.getQueryString() : "");
        String empreinte = empreinte(request.getMethod(), chemin, requete.corps);

        try {
            jdbc.update("INSERT INTO cles_idempotence (cle, utilisateur, methode, chemin, empreinte) VALUES (?, ?, ?, ?, ?)",
                    cle, utilisateur, request.getMethod(), tronquer(chemin, 500), empreinte);
        } catch (DuplicateKeyException dejaVue) {
            rejouer(cle, utilisateur, empreinte, response);
            return;
        }

        ContentCachingResponseWrapper reponse = new ContentCachingResponseWrapper(response);
        boolean enregistree = false;
        try {
            chain.doFilter(requete, reponse);
            if (reponse.getStatus() < 500) {
                jdbc.update("UPDATE cles_idempotence SET statut_http = ?, type_contenu = ?, reponse = ? WHERE cle = ?",
                        reponse.getStatus(), reponse.getContentType(), reponse.getContentAsByteArray(), cle);
                enregistree = true;
            }
        } finally {
            if (!enregistree) {
                // Erreur serveur ou exception : l'action n'a pas abouti, la clé peut être réessayée.
                jdbc.update("DELETE FROM cles_idempotence WHERE cle = ?", cle);
            }
            reponse.copyBodyToResponse();
        }
    }

    private void rejouer(UUID cle, String utilisateur, String empreinte, HttpServletResponse response) throws IOException {
        List<Map<String, Object>> lignes = jdbc.queryForList(
                "SELECT utilisateur, empreinte, statut_http, type_contenu, reponse FROM cles_idempotence WHERE cle = ?", cle);
        if (lignes.isEmpty()) {
            // Libérée entre-temps après une erreur serveur : l'appelant peut réessayer.
            erreur(response, 409, "CONFLICT", "Requête en cours de traitement, réessayez dans un instant.");
            return;
        }
        Map<String, Object> l = lignes.get(0);
        if (!utilisateur.equals(l.get("utilisateur")) || !empreinte.equals(l.get("empreinte"))) {
            erreur(response, 422, "IDEMPOTENCY_KEY_REUSED",
                    "Cette clé d'idempotence a déjà servi pour une autre requête.");
            return;
        }
        if (l.get("statut_http") == null) {
            erreur(response, 409, "CONFLICT", "Cette action est déjà en cours de traitement.");
            return;
        }
        log.info("Requête rejouée depuis la clé d'idempotence {} ({})", cle, utilisateur);
        response.setStatus(((Number) l.get("statut_http")).intValue());
        response.setHeader("Idempotent-Replayed", "true");
        if (l.get("type_contenu") != null) response.setContentType((String) l.get("type_contenu"));
        byte[] corps = (byte[]) l.get("reponse");
        if (corps != null && corps.length > 0) response.getOutputStream().write(corps);
    }

    private static void erreur(HttpServletResponse response, int statut, String code, String message) throws IOException {
        response.setStatus(statut);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"code\":\"" + code + "\",\"message\":\"" + message.replace("\"", "'") + "\",\"details\":null}");
    }

    private static String empreinte(String methode, String chemin, byte[] corps) {
        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            sha.update((methode + " " + chemin + "\n").getBytes(StandardCharsets.UTF_8));
            sha.update(corps);
            return HexFormat.of().formatHex(sha.digest());
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String tronquer(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max);
    }

    /** Requête dont le corps est lu une fois puis relu autant que nécessaire (empreinte, puis contrôleur). */
    private static final class CorpsMemorise extends HttpServletRequestWrapper {
        final byte[] corps;

        CorpsMemorise(HttpServletRequest request) throws IOException {
            super(request);
            this.corps = request.getInputStream().readAllBytes();
        }

        @Override
        public ServletInputStream getInputStream() {
            ByteArrayInputStream in = new ByteArrayInputStream(corps);
            return new ServletInputStream() {
                @Override public boolean isFinished() { return in.available() == 0; }
                @Override public boolean isReady() { return true; }
                @Override public void setReadListener(ReadListener listener) { throw new UnsupportedOperationException(); }
                @Override public int read() { return in.read(); }
                @Override public int read(byte[] b, int off, int len) { return in.read(b, off, len); }
            };
        }

        @Override
        public BufferedReader getReader() {
            return new BufferedReader(new InputStreamReader(getInputStream(), StandardCharsets.UTF_8));
        }
    }
}
