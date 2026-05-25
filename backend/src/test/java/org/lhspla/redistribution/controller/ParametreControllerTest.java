package org.lhspla.redistribution.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.lhspla.redistribution.entity.Region;
import org.lhspla.redistribution.entity.Role;
import org.lhspla.redistribution.entity.Utilisateur;
import org.lhspla.redistribution.exception.GlobalExceptionHandler;
import org.lhspla.redistribution.repository.RegionRepository;
import org.lhspla.redistribution.repository.UtilisateurRepository;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class ParametreControllerTest {

    @Mock RegionRepository regionRepo;
    @Mock UtilisateurRepository utilisateurRepo;

    @InjectMocks ParametreController controller;

    MockMvc mockMvc;
    ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        // Standalone setup : pas de contexte Spring Security chargé.
        // AuthenticationPrincipalArgumentResolver lit SecurityContextHolder.
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    // ── GET /api/parametres/region ───────────────────────────────────────────────

    @Test
    void get_retourne_le_seuil_de_la_region_de_l_utilisateur() throws Exception {
        Region region = regionFactice(1L, "Analamanga Test", new BigDecimal("2.5"));
        when(utilisateurRepo.findByUsername("pharmacien01"))
                .thenReturn(Optional.of(utilisateurAvecRegion("pharmacien01", region)));
        when(regionRepo.findById(1L)).thenReturn(Optional.of(region));
        connecter("pharmacien01", "ROLE_PHARMACIEN_REGION");

        mockMvc.perform(get("/api/parametres/region"))
               .andExpect(status().isOk())
               .andExpect(jsonPath("$.regionId").value(1))
               .andExpect(jsonPath("$.regionNom").value("Analamanga Test"))
               .andExpect(jsonPath("$.seuilStockSecuriteMsd").value(2.5));
    }

    @Test
    void get_avec_regionId_explicite_retourne_la_bonne_region() throws Exception {
        Region region = regionFactice(3L, "Vakinankaratra Test", new BigDecimal("3.0"));
        when(utilisateurRepo.findByUsername("admin_sys"))
                .thenReturn(Optional.of(utilisateurSansRegion("admin_sys")));
        when(regionRepo.findById(3L)).thenReturn(Optional.of(region));
        connecter("admin_sys", "ROLE_ADMIN");

        mockMvc.perform(get("/api/parametres/region").param("regionId", "3"))
               .andExpect(status().isOk())
               .andExpect(jsonPath("$.regionId").value(3))
               .andExpect(jsonPath("$.seuilStockSecuriteMsd").value(3.0));
    }

    @Test
    void get_retourne_400_si_admin_sans_region_et_sans_regionId() throws Exception {
        when(utilisateurRepo.findByUsername("admin_sys"))
                .thenReturn(Optional.of(utilisateurSansRegion("admin_sys")));
        connecter("admin_sys", "ROLE_ADMIN");

        mockMvc.perform(get("/api/parametres/region"))
               .andExpect(status().isBadRequest());
    }

    // ── PUT /api/parametres/region ───────────────────────────────────────────────

    @Test
    void put_met_a_jour_le_seuil_et_retourne_la_nouvelle_valeur() throws Exception {
        Region region = regionFactice(1L, "Analamanga Test", new BigDecimal("2.0"));
        when(utilisateurRepo.findByUsername("pharmacien01"))
                .thenReturn(Optional.of(utilisateurAvecRegion("pharmacien01", region)));
        when(regionRepo.findById(1L)).thenReturn(Optional.of(region));
        when(regionRepo.save(any(Region.class))).thenAnswer(inv -> inv.getArgument(0));
        connecter("pharmacien01", "ROLE_PHARMACIEN_REGION");

        String body = """
                { "seuilStockSecuriteMsd": 3.5 }
                """;

        mockMvc.perform(put("/api/parametres/region")
                       .contentType(MediaType.APPLICATION_JSON)
                       .content(body))
               .andExpect(status().isOk())
               .andExpect(jsonPath("$.seuilStockSecuriteMsd").value(3.5));
    }

    @Test
    void put_retourne_400_si_seuil_inferieur_a_minimum() throws Exception {
        connecter("pharmacien01", "ROLE_PHARMACIEN_REGION");

        mockMvc.perform(put("/api/parametres/region")
                       .contentType(MediaType.APPLICATION_JSON)
                       .content("{ \"seuilStockSecuriteMsd\": 0.2 }"))
               .andExpect(status().isBadRequest());
    }

    @Test
    void put_retourne_400_si_seuil_superieur_a_maximum() throws Exception {
        connecter("pharmacien01", "ROLE_PHARMACIEN_REGION");

        mockMvc.perform(put("/api/parametres/region")
                       .contentType(MediaType.APPLICATION_JSON)
                       .content("{ \"seuilStockSecuriteMsd\": 15.0 }"))
               .andExpect(status().isBadRequest());
    }

    @Test
    void put_avec_regionId_dans_le_body_cible_la_bonne_region() throws Exception {
        Region region = regionFactice(7L, "Menabe Test", new BigDecimal("2.0"));
        when(utilisateurRepo.findByUsername("admin_sys"))
                .thenReturn(Optional.of(utilisateurSansRegion("admin_sys")));
        when(regionRepo.findById(7L)).thenReturn(Optional.of(region));
        when(regionRepo.save(any(Region.class))).thenAnswer(inv -> inv.getArgument(0));
        connecter("admin_sys", "ROLE_ADMIN");

        mockMvc.perform(put("/api/parametres/region")
                       .contentType(MediaType.APPLICATION_JSON)
                       .content("{ \"seuilStockSecuriteMsd\": 4.0, \"regionId\": 7 }"))
               .andExpect(status().isOk())
               .andExpect(jsonPath("$.regionId").value(7))
               .andExpect(jsonPath("$.seuilStockSecuriteMsd").value(4.0));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private void connecter(String username, String... authorities) {
        UserDetails userDetails = User.builder()
                .username(username)
                .password("PLACEHOLDER_PASSWORD_FOR_TESTS_ONLY")
                .authorities(List.of(new SimpleGrantedAuthority(authorities[0])))
                .build();
        Authentication auth = new UsernamePasswordAuthenticationToken(
                userDetails, null, userDetails.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private Region regionFactice(Long id, String nom, BigDecimal seuil) {
        Region r = new Region();
        r.setId(id);
        r.setNom(nom);
        r.setSeuilStockSecuriteMsd(seuil);
        return r;
    }

    private Utilisateur utilisateurAvecRegion(String username, Region region) {
        Role role = new Role();
        role.setName("PHARMACIEN_REGION");
        Utilisateur u = new Utilisateur();
        u.setUsername(username);
        u.setRole(role);
        u.setRegion(region);
        return u;
    }

    private Utilisateur utilisateurSansRegion(String username) {
        Role role = new Role();
        role.setName("ADMIN");
        Utilisateur u = new Utilisateur();
        u.setUsername(username);
        u.setRole(role);
        u.setRegion(null);
        return u;
    }
}
