package org.lhspla.redistribution.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.lhspla.redistribution.entity.*;
import org.lhspla.redistribution.exception.BusinessException;
import org.lhspla.redistribution.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.*;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ImportReferentielService {

    private final RegionRepository regionRepo;
    private final DistrictRepository districtRepo;
    private final StructureRepository structureRepo;
    private final ProgrammeRepository programmeRepo;
    private final ProduitRepository produitRepo;
    private final StructureProgrammeRepository spRepo;

    public record ImportResult(int created, int updated, int errors, List<String> messages) {}

    public ImportResult importGeo(MultipartFile file) {
        int created = 0, updated = 0, errors = 0;
        List<String> messages = new ArrayList<>();

        try (Workbook wb = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = wb.getSheetAt(0);
            // Ligne 0 = entêtes, skip
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;

                String nomRegion = getCellString(row, 0);
                String nomDistrict = getCellString(row, 1);
                String nomStructure = getCellString(row, 2);
                String codeStructure = getCellString(row, 3);
                String typeStructure = getCellString(row, 4);

                if (nomRegion.isBlank() || nomDistrict.isBlank() || nomStructure.isBlank()) continue;

                try {
                    // Upsert Région
                    Region region = regionRepo.findByNomIgnoreCase(nomRegion).orElseGet(() -> {
                        Region r = new Region(); r.setNom(nomRegion);
                        return regionRepo.save(r);
                    });

                    // Upsert District
                    District district = districtRepo.findByNomIgnoreCaseAndRegionId(nomDistrict, region.getId())
                        .orElseGet(() -> {
                            District d = new District(); d.setNom(nomDistrict); d.setRegion(region);
                            return districtRepo.save(d);
                        });

                    // Upsert Structure (par code si fourni, sinon par nom+district)
                    Optional<Structure> existing = codeStructure.isBlank()
                        ? structureRepo.findByNomIgnoreCaseAndDistrictId(nomStructure, district.getId())
                        : structureRepo.findByCode(codeStructure);

                    if (existing.isPresent()) {
                        Structure s = existing.get();
                        s.setNom(nomStructure);
                        s.setDistrict(district);
                        if (!typeStructure.isBlank()) s.setType(typeStructure);
                        if (!codeStructure.isBlank()) s.setCode(codeStructure);
                        structureRepo.save(s);
                        updated++;
                    } else {
                        Structure s = new Structure();
                        s.setNom(nomStructure);
                        s.setCode(codeStructure.isBlank() ? "S" + UUID.randomUUID().toString().replace("-","").substring(0,8).toUpperCase() : codeStructure);
                        s.setType(typeStructure.isBlank() ? "CS" : typeStructure);
                        s.setDistrict(district);
                        s.setActive(true);
                        structureRepo.save(s);
                        created++;
                    }
                } catch (Exception e) {
                    errors++;
                    messages.add("Ligne " + (i + 1) + ": " + e.getMessage());
                    log.warn("Import geo ligne {}: {}", i + 1, e.getMessage());
                }
            }
        } catch (IOException e) {
            throw BusinessException.badRequest("Fichier Excel invalide: " + e.getMessage());
        }
        return new ImportResult(created, updated, errors, messages);
    }

    public ImportResult importCatalogue(MultipartFile file) {
        int created = 0, updated = 0, errors = 0;
        List<String> messages = new ArrayList<>();

        try (Workbook wb = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = wb.getSheetAt(0);
            Set<Long> syncedProgrammeIds = new HashSet<>();
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;

                String nomProgramme = getCellString(row, 0);
                String codeProgramme = getCellString(row, 1);
                String nomProduit = getCellString(row, 2);
                String codeProduit = getCellString(row, 3);
                String uniteProduit = getCellString(row, 4);

                if (nomProgramme.isBlank() || nomProduit.isBlank()) continue;

                try {
                    // Upsert Programme — cherche toujours par nom en priorité
                    Optional<Programme> existingProg = programmeRepo.findByNomIgnoreCase(nomProgramme);
                    Programme programme;
                    if (existingProg.isPresent()) {
                        programme = existingProg.get();
                    } else {
                        Programme p = new Programme();
                        p.setNom(nomProgramme);
                        boolean codeUtilisable = !codeProgramme.isBlank()
                            && !codeProgramme.equalsIgnoreCase(nomProgramme)
                            && codeProgramme.length() <= 50;
                        p.setCode(codeUtilisable ? codeProgramme
                            : "P" + UUID.randomUUID().toString().replace("-","").substring(0,8).toUpperCase());
                        p.setActive(true);
                        programme = programmeRepo.save(p);
                    }
                    // Sync SP entries once per programme per import (new ou existant)
                    if (syncedProgrammeIds.add(programme.getId())) {
                        for (Structure s : structureRepo.findByActiveTrue()) {
                            if (spRepo.findByStructureIdAndProgrammeId(s.getId(), programme.getId()).isEmpty()) {
                                StructureProgramme sp = new StructureProgramme();
                                sp.setStructure(s); sp.setProgramme(programme); sp.setActif(true);
                                spRepo.save(sp);
                            }
                        }
                    }

                    // Upsert Produit — unicité sur (code, programme)
                    Optional<Produit> existing = codeProduit.isBlank()
                        ? produitRepo.findByNomIgnoreCaseAndProgrammeId(nomProduit, programme.getId())
                        : produitRepo.findByCodeIgnoreCaseAndProgrammeId(codeProduit, programme.getId());

                    if (existing.isPresent()) {
                        Produit p = existing.get();
                        p.setNom(nomProduit);
                        p.setProgramme(programme);
                        if (!uniteProduit.isBlank()) p.setUnite(uniteProduit);
                        if (!codeProduit.isBlank()) p.setCode(codeProduit);
                        produitRepo.save(p);
                        updated++;
                    } else {
                        Produit p = new Produit();
                        p.setCode(codeProduit.isBlank() ? "P" + UUID.randomUUID().toString().replace("-","").substring(0,8).toUpperCase() : codeProduit);
                        p.setNom(nomProduit);
                        p.setUnite(uniteProduit.isBlank() ? "unité" : uniteProduit);
                        p.setProgramme(programme);
                        p.setActif(true);
                        produitRepo.save(p);
                        created++;
                    }
                } catch (Exception e) {
                    errors++;
                    messages.add("Ligne " + (i + 1) + ": " + e.getMessage());
                    log.warn("Import catalogue ligne {}: {}", i + 1, e.getMessage());
                }
            }
        } catch (IOException e) {
            throw BusinessException.badRequest("Fichier Excel invalide: " + e.getMessage());
        }
        return new ImportResult(created, updated, errors, messages);
    }

    private String getCellString(Row row, int col) {
        Cell cell = row.getCell(col, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        if (cell == null) return "";
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().trim();
            case NUMERIC -> {
                double v = cell.getNumericCellValue();
                yield v == Math.floor(v) ? String.valueOf((long) v) : String.valueOf(v);
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            default -> "";
        };
    }
}
