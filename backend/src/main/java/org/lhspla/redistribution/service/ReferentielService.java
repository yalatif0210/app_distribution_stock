package org.lhspla.redistribution.service;

import lombok.RequiredArgsConstructor;
import org.lhspla.redistribution.dto.response.*;
import org.lhspla.redistribution.entity.*;
import org.lhspla.redistribution.exception.BusinessException;
import org.lhspla.redistribution.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReferentielService {

    private final RegionRepository regionRepo;
    private final DistrictRepository districtRepo;
    private final StructureRepository structureRepo;
    private final ProgrammeRepository programmeRepo;
    private final ProduitRepository produitRepo;
    private final PeriodeSaisieRepository periodeRepo;
    private final StructureProgrammeRepository spRepo;

    public List<RegionDTO> findAllRegions() {
        return regionRepo.findAll().stream().map(this::toRegionDTO).toList();
    }

    public List<DistrictDTO> findDistrictsByRegion(Long regionId) {
        List<District> districts = regionId != null
            ? districtRepo.findByRegionId(regionId)
            : districtRepo.findAll();
        return districts.stream().map(this::toDistrictDTO).toList();
    }

    public List<StructureDTO> findStructures(Long regionId, Long districtId) {
        List<Structure> structures;
        if (districtId != null) {
            structures = structureRepo.findByDistrictId(districtId);
        } else if (regionId != null) {
            structures = structureRepo.findByRegionId(regionId);
        } else {
            structures = structureRepo.findByActiveTrue();
        }
        return structures.stream().map(this::toStructureDTO).toList();
    }

    public StructureDTO findStructureById(Long id) {
        return structureRepo.findById(id)
                .map(this::toStructureDTO)
                .orElseThrow(() -> BusinessException.notFound("Structure", id));
    }

    public List<ProgrammeDTO> findAllProgrammes() {
        return programmeRepo.findAll().stream().map(this::toProgrammeDTO).toList();
    }

    public List<ProduitDTO> findProduits(Long programmeId) {
        List<Produit> produits = programmeId != null
                ? produitRepo.findByProgrammeId(programmeId)
                : produitRepo.findByActifTrue();
        return produits.stream().map(this::toProduitDTO).toList();
    }

    public List<PeriodeSaisieDTO> findAllPeriodes() {
        return periodeRepo.findAllByOrderByAnneeDescMoisDesc().stream().map(this::toPeriodeDTO).toList();
    }

    @Transactional
    public PeriodeSaisieDTO createPeriode(Integer annee, Integer mois, java.time.LocalDate dateRas) {
        periodeRepo.findByAnneeAndMois(annee, mois).ifPresent(p -> {
            throw BusinessException.badRequest("Une période existe déjà pour " + mois + "/" + annee);
        });
        PeriodeSaisie periode = new PeriodeSaisie();
        periode.setAnnee(annee);
        periode.setMois(mois);
        periode.setDateRas(dateRas);
        return toPeriodeDTO(periodeRepo.save(periode));
    }

    @Transactional
    public void fermerPeriode(Long id) {
        PeriodeSaisie periode = periodeRepo.findById(id)
                .orElseThrow(() -> BusinessException.notFound("Période", id));
        periode.setStatut("FERMEE");
        periodeRepo.save(periode);
    }

    // --- Write operations (admin CRUD) ---

    @Transactional
    public RegionDTO saveRegion(String nom, Long id) {
        Region r = id != null ? regionRepo.findById(id).orElseThrow(() -> BusinessException.notFound("Region", id)) : new Region();
        r.setNom(nom);
        return toRegionDTO(regionRepo.save(r));
    }

    @Transactional
    public void deleteRegion(Long id) { regionRepo.deleteById(id); }

    @Transactional
    public DistrictDTO saveDistrict(String nom, Long regionId, Long id) {
        District d = id != null ? districtRepo.findById(id).orElseThrow(() -> BusinessException.notFound("District", id)) : new District();
        d.setNom(nom);
        Region region = regionRepo.findById(regionId).orElseThrow(() -> BusinessException.notFound("Region", regionId));
        d.setRegion(region);
        return toDistrictDTO(districtRepo.save(d));
    }

    @Transactional
    public void deleteDistrict(Long id) { districtRepo.deleteById(id); }

    @Transactional
    public StructureDTO saveStructure(String code, String nom, String type, Long districtId, Boolean active, Long id) {
        boolean isNew = id == null;
        Structure s = isNew ? new Structure() : structureRepo.findById(id).orElseThrow(() -> BusinessException.notFound("Structure", id));
        s.setCode(code); s.setNom(nom); s.setType(type); s.setActive(active != null ? active : true);
        District district = districtRepo.findById(districtId).orElseThrow(() -> BusinessException.notFound("District", districtId));
        s.setDistrict(district);
        Structure saved = structureRepo.save(s);
        if (isNew) {
            programmeRepo.findByActiveTrue().forEach(p -> createSpEntryIfAbsent(saved, p));
        }
        return toStructureDTO(saved);
    }

    @Transactional
    public void deleteStructure(Long id) { structureRepo.deleteById(id); }

    @Transactional
    public ProgrammeDTO saveProgramme(String code, String nom, String description, Boolean active, Long id) {
        boolean isNew = id == null;
        Programme p = isNew ? new Programme() : programmeRepo.findById(id).orElseThrow(() -> BusinessException.notFound("Programme", id));
        p.setCode(code); p.setNom(nom); p.setDescription(description); p.setActive(active != null ? active : true);
        Programme saved = programmeRepo.save(p);
        if (isNew) {
            structureRepo.findByActiveTrue().forEach(s -> createSpEntryIfAbsent(s, saved));
        }
        return toProgrammeDTO(saved);
    }

    @Transactional
    public void deleteProgramme(Long id) {
        Programme p = programmeRepo.findById(id).orElseThrow(() -> BusinessException.notFound("Programme", id));
        p.setActive(false);
        programmeRepo.save(p);
    }

    @Transactional
    public ProduitDTO saveProduit(String code, String nom, String unite, Long programmeId, Boolean actif, Long id) {
        Produit p = id != null ? produitRepo.findById(id).orElseThrow(() -> BusinessException.notFound("Produit", id)) : new Produit();
        p.setCode(code); p.setNom(nom); p.setUnite(unite); p.setActif(actif != null ? actif : true);
        Programme prog = programmeRepo.findById(programmeId).orElseThrow(() -> BusinessException.notFound("Programme", programmeId));
        p.setProgramme(prog);
        return toProduitDTO(produitRepo.save(p));
    }

    @Transactional
    public void deleteProduit(Long id) {
        Produit p = produitRepo.findById(id).orElseThrow(() -> BusinessException.notFound("Produit", id));
        p.setActif(false);
        produitRepo.save(p);
    }

    private void createSpEntryIfAbsent(Structure s, Programme p) {
        if (spRepo.findByStructureIdAndProgrammeId(s.getId(), p.getId()).isEmpty()) {
            StructureProgramme sp = new StructureProgramme();
            sp.setStructure(s);
            sp.setProgramme(p);
            sp.setActif(true);
            spRepo.save(sp);
        }
    }

    // --- Mappers ---

    private RegionDTO toRegionDTO(Region r) {
        RegionDTO dto = new RegionDTO();
        dto.setId(r.getId());
        dto.setNom(r.getNom());
        return dto;
    }

    private DistrictDTO toDistrictDTO(District d) {
        DistrictDTO dto = new DistrictDTO();
        dto.setId(d.getId());
        dto.setNom(d.getNom());
        if (d.getRegion() != null) {
            dto.setRegionId(d.getRegion().getId());
            dto.setRegionNom(d.getRegion().getNom());
        }
        return dto;
    }

    public StructureDTO toStructureDTO(Structure s) {
        StructureDTO dto = new StructureDTO();
        dto.setId(s.getId());
        dto.setCode(s.getCode());
        dto.setNom(s.getNom());
        dto.setType(s.getType());
        dto.setActive(s.getActive());
        if (s.getDistrict() != null) {
            dto.setDistrictId(s.getDistrict().getId());
            dto.setDistrictNom(s.getDistrict().getNom());
            if (s.getDistrict().getRegion() != null) {
                dto.setRegionId(s.getDistrict().getRegion().getId());
                dto.setRegionNom(s.getDistrict().getRegion().getNom());
            }
        }
        return dto;
    }

    private ProgrammeDTO toProgrammeDTO(Programme p) {
        ProgrammeDTO dto = new ProgrammeDTO();
        dto.setId(p.getId());
        dto.setCode(p.getCode());
        dto.setNom(p.getNom());
        dto.setDescription(p.getDescription());
        dto.setActive(p.getActive());
        return dto;
    }

    private ProduitDTO toProduitDTO(Produit p) {
        ProduitDTO dto = new ProduitDTO();
        dto.setId(p.getId());
        dto.setCode(p.getCode());
        dto.setNom(p.getNom());
        dto.setUnite(p.getUnite());
        dto.setActif(p.getActif());
        if (p.getProgramme() != null) {
            dto.setProgrammeId(p.getProgramme().getId());
            dto.setProgrammeCode(p.getProgramme().getCode());
        }
        return dto;
    }

    public PeriodeSaisieDTO toPeriodeDTO(PeriodeSaisie p) {
        PeriodeSaisieDTO dto = new PeriodeSaisieDTO();
        dto.setId(p.getId());
        dto.setAnnee(p.getAnnee());
        dto.setMois(p.getMois());
        dto.setDateRas(p.getDateRas());
        dto.setStatut(p.getStatut());
        dto.setLibelle(p.getDateRas().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy")));
        return dto;
    }
}
