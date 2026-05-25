package org.lhspla.redistribution.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.lhspla.redistribution.dto.request.RelanceRequest;
import org.lhspla.redistribution.dto.response.CompletudeDTO;
import org.lhspla.redistribution.entity.Notification;
import org.lhspla.redistribution.entity.PeriodeSaisie;
import org.lhspla.redistribution.entity.Programme;
import org.lhspla.redistribution.entity.Structure;
import org.lhspla.redistribution.entity.StructureProgramme;
import org.lhspla.redistribution.entity.Utilisateur;
import org.lhspla.redistribution.exception.BusinessException;
import org.lhspla.redistribution.repository.NotificationRepository;
import org.lhspla.redistribution.repository.PeriodeSaisieRepository;
import org.lhspla.redistribution.repository.ProgrammeRepository;
import org.lhspla.redistribution.repository.SaisieStockRepository;
import org.lhspla.redistribution.repository.StructureProgrammeRepository;
import org.lhspla.redistribution.repository.StructureRepository;
import org.lhspla.redistribution.repository.UtilisateurRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class CompletudeSaisieService {

    private final StructureProgrammeRepository structureProgrammeRepo;
    private final SaisieStockRepository saisieStockRepo;
    private final UtilisateurRepository utilisateurRepo;
    private final NotificationRepository notificationRepo;
    private final PeriodeSaisieRepository periodeRepo;
    private final ProgrammeRepository programmeRepo;
    private final StructureRepository structureRepo;

    public CompletudeDTO getCompletude(Long periodeId, Long programmeId, Long regionId) {
        PeriodeSaisie periode = periodeRepo.findById(periodeId)
                .orElseThrow(() -> BusinessException.notFound("Période", periodeId));
        Programme programme = programmeRepo.findById(programmeId)
                .orElseThrow(() -> BusinessException.notFound("Programme", programmeId));

        // 1. Structures attendues (toutes régions si regionId=null)
        List<StructureProgramme> attendues = regionId != null
                ? structureProgrammeRepo.findActiveByProgrammeAndRegion(programmeId, regionId)
                : structureProgrammeRepo.findActiveByProgramme(programmeId);
        Set<Long> idsAttendus = attendues.stream()
                .map(sp -> sp.getStructure().getId())
                .collect(Collectors.toSet());

        // 2. Structures ayant saisi (statut SUBMITTED uniquement)
        Set<Long> idsSaisi = saisieStockRepo
                .findSubmittedByPeriodeIdAndProgrammeId(periodeId, programmeId)
                .stream()
                .map(s -> s.getStructure().getId())
                .collect(Collectors.toSet());

        // 3. Structures manquantes + comptage réel dans cette région
        // idsSaisi peut contenir des structures d'autres régions → on intersecte avec idsAttendus
        long countSaisi = idsAttendus.stream().filter(idsSaisi::contains).count();
        Set<Long> idsManquants = idsAttendus.stream()
                .filter(id -> !idsSaisi.contains(id))
                .collect(Collectors.toSet());

        // 4. Calcul taux basé sur l'intersection (structures attendues ici qui ont soumis)
        double tauxCompletude = idsAttendus.isEmpty()
                ? 0.0
                : (double) countSaisi / idsAttendus.size() * 100.0;

        // 5. Mapper les structures manquantes
        List<CompletudeDTO.StructureSimpleDTO> structuresManquantes = attendues.stream()
                .filter(sp -> idsManquants.contains(sp.getStructure().getId()))
                .map(sp -> {
                    Structure s = sp.getStructure();
                    CompletudeDTO.StructureSimpleDTO dto = new CompletudeDTO.StructureSimpleDTO();
                    dto.setId(s.getId());
                    dto.setCode(s.getCode());
                    dto.setNom(s.getNom());
                    dto.setType(s.getType());
                    return dto;
                })
                .toList();

        CompletudeDTO result = new CompletudeDTO();
        result.setPeriodeId(periodeId);
        result.setProgrammeId(programmeId);
        result.setRegionId(regionId);
        result.setProgrammeNom(programme.getNom());
        result.setPeriodeLibelle(periode.getDateRas().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy")));
        result.setTotalAttendu(idsAttendus.size());
        result.setTotalSaisi((int) countSaisi);
        result.setTauxCompletude(Math.round(tauxCompletude * 100.0) / 100.0);
        result.setStructuresManquantes(structuresManquantes);

        return result;
    }

    @Transactional
    public void relancer(RelanceRequest req, String username) {
        PeriodeSaisie periode = periodeRepo.findById(req.getPeriodeId())
                .orElseThrow(() -> BusinessException.notFound("Période", req.getPeriodeId()));
        Programme programme = programmeRepo.findById(req.getProgrammeId())
                .orElseThrow(() -> BusinessException.notFound("Programme", req.getProgrammeId()));

        String periodeLibelle = periode.getDateRas().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"));
        String messageTemplate = "Rappel: veuillez saisir l'état de stock pour la période "
                + periodeLibelle + " / programme " + programme.getNom();

        List<Notification> notifications = new ArrayList<>();

        for (Long structureId : req.getStructureIds()) {
            List<Utilisateur> gestionnaires = utilisateurRepo.findByStructureId(structureId);
            for (Utilisateur gestionnaire : gestionnaires) {
                Notification notif = new Notification();
                notif.setType("RELANCE_SAISIE");
                notif.setMessage(messageTemplate);
                notif.setDestinataire(gestionnaire);
                notifications.add(notif);
            }
        }

        notificationRepo.saveAll(notifications);
        log.info("Relance envoyée par {} pour {} structures, période {}, programme {}",
                username, req.getStructureIds().size(), periodeLibelle, programme.getNom());
    }
}
