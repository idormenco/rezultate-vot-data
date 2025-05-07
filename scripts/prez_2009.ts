import chalk from "chalk";
import { stringify } from "csv-stringify/sync";
import { promises as fs } from "fs";
import Papa from "papaparse";
import { RecordsData, toSqlValue, TurnoutData, VotesData } from "./utils";

interface CandidateDetails {
  name: string;
  key: string;
}

interface PVData {
  NCE: number;
  JUDET: string;
  SIRUTA: number;
  CountyId: number;
  LocalityId: number;
  CountryId: string | null;
  DENLOC: string;
  SV: number;
  ADRESA: string;
  A: number;
  B: number;
  B1: number;
  B2: number;
  B3: number;
  C: number;
  D: number;
  E: number;
  F: number;
  P1: number;
  P2: number;
  P3: number;
  P4: number;
  P5: number;
  P6: number;
  P7: number;
  P8: number;
  P9: number;
  P10: number;
  P11: number;
  P12: number;
  MEDIU: number;
  SORTARE: number;
  SPEC: number;
}

const COLOR = "#000000";

async function getPartiesData(
  electionId: number,
  candidates: CandidateDetails[]
) {
  const partyVarNames = new Map<string, string>();

  const partyInserts = candidates.map((candidate, index) => {
    const varName = `@party_${index}`;
    partyVarNames.set(`CP_${index}`, varName);

    return `INSERT INTO \`rezultatevot\`.\`parties\` (
          \`name\`,
          \`acronym\`,
          \`color\`,
          \`election_id\`,
          \`created_at\`,
          \`updated_at\`
        ) VALUES (
          ${toSqlValue(`Party of ${candidate.name}`)},
          ${toSqlValue(`Party of ${candidate.name}`)},
          ${toSqlValue(COLOR)},
          ${electionId},
          NOW(),
          NOW());
          SET ${varName} = LAST_INSERT_ID();`;
  });

  return {
    partyInserts,
    partyVarNames,
  };
}

function getCandidatesData(
  electionId: number,
  partyVarNames: Map<string, string>,
  candidates: CandidateDetails[],
  resultsAccessorFn?: (name: string) => string
) {
  const candidatesVarLookup = new Map<
    string,
    { varName: string; resultsAccessorFn: (name: string) => string }
  >();

  const candidateInserts = candidates.map((candidat, index) => {
    const varName = `@candidat_${index + 1}`;
    candidatesVarLookup.set(candidat.name.trim(), {
      varName,
      resultsAccessorFn: resultsAccessorFn
        ? resultsAccessorFn
        : (name: string) => candidat.key,
    });
    const partyVar = partyVarNames.get(`CP_${index}`);

    return `INSERT INTO \`rezultatevot\`.\`candidates\`(
        \`name\`,
        \`display_name\`,
        \`color\`,
        \`election_id\`,
        \`party_id\`,
        \`created_at\`,
        \`updated_at\`
      )VALUES (
        ${toSqlValue(candidat.name)},
        NULL,
        "#808080",
        ${electionId},
        ${partyVar},
        NOW(),
        NOW());
       SET ${varName} = LAST_INSERT_ID();`;
  });

  return { candidateInserts, candidatesVarLookup };
}

async function parseResults(
  electionId: number,
  file: string,
  candidatesLookup: Map<
    string,
    { varName: string; resultsAccessorFn: (name: string) => string }
  >
) {
  const rawData = await fs.readFile(file, "utf-8");

  const parsedData = Papa.parse<PVData>(rawData, {
    header: true,
    skipEmptyLines: true,
    delimiter: ",",
    dynamicTyping: true,
  });

  const votesInserts: string[] = [];
  const votesData: VotesData[] = [];

  const turnoutsInserts: string[] = [];
  const turnoutsData: TurnoutData[] = [];

  const recordsInserts: string[] = [];
  const recordsData: RecordsData[] = [];

  for (var data of parsedData.data) {
    for (var [candidate, { varName, resultsAccessorFn }] of candidatesLookup) {
      const votesInsert = `INSERT INTO \`rezultatevot\`.\`votes\` (
          \`election_id\`,
          \`country_id\`,
          \`county_id\`,
          \`locality_id\`,
          \`section\`,
          \`part\`,
          \`votable_type\`,
          \`votable_id\`,
          \`votes\`
          ) VALUES (
          ${electionId},
          ${toSqlValue(data.CountryId)},
          ${data.CountyId},
          ${data.LocalityId},
          ${data.SV},
          0,
          \`candidate\`,
          ${varName},
          ${data[resultsAccessorFn(candidate)]});`;

      votesInserts.push(votesInsert);
      votesData.push({
        election_id: electionId,
        country_id: data.CountryId,
        county_id: data.CountyId,
        locality_id: data.LocalityId,
        part: 0,
        section: data.SV,
        votable_id: varName,
        votable_type: "candidate",
        votes: data[resultsAccessorFn(candidate)],
      });
    }

    const turnoutsInsert = `INSERT INTO \`rezultatevot\`.\`turnouts\` (
      \`has_issues\`,
      \`election_id\`,
      \`country_id\`,
      \`county_id\`,
      \`locality_id\`,
      \`section\`,
      \`initial_permanent\`,
      \`initial_complement\`,
      \`permanent\`,
      \`complement\`,
      \`supplement\`,
      \`mobile\`,
      \`initial_total\`,
      \`total\`,
      \`percent\`,
      \`area\`,
      \`men_18-24\`,
      \`men_25-34\`,
      \`men_35-44\`,
      \`men_45-64\`,
      \`men_65\`,
      \`women_18-24\`,
      \`women_25-34\`,
      \`women_35-44\`,
      \`women_45-64\`,
      \`women_65\`
    ) VALUES (
      1,
      ${electionId},
      ${data.CountryId},
      ${data.CountyId},
      ${data.LocalityId},
      ${data.SV},
      ${data.A_SV},
      0,
      ${data.APP_SV},
      0,
      ${data.APS_SV},
      0,
      ${data.A_SV},
      ${data.C},
      ${((data.B / data.A) * 100).toFixed(2)},
      ${data.MEDIU === 1 ? "U" : "R"},
      0, 0, 0, 0, 0,
      0, 0, 0, 0, 0
    );`;

    turnoutsInserts.push(turnoutsInsert);
    turnoutsData.push({
      has_issues: 1,
      election_id: electionId,
      country_id: data.CountryId,
      county_id: data.CountyId,
      locality_id: data.LocalityId,
      section: data.SV,
      initial_permanent: data.A,
      initial_complement: 0,
      permanent: data.APP_SV,
      complement: 0,
      supplement: data.APS_SV,
      mobile: 0,
      initial_total: data.A_SV,
      total: data.C,
      percent: parseFloat(((data.B / data.A) * 100).toFixed(2)),
      area: data.MEDIU === 1 ? "U" : "R",
      men_18_24: 0,
      men_25_34: 0,
      men_35_44: 0,
      men_45_64: 0,
      men_65: 0,
      women_18_24: 0,
      women_25_34: 0,
      women_35_44: 0,
      women_45_64: 0,
      women_65: 0,
    });

    recordsInserts.push(`
      INSERT INTO \`rezultatevot\`.\`records\` (
        \`has_issues\`,
        \`election_id\`,
        \`country_id\`,
        \`county_id\`,
        \`locality_id\`,
        \`section\`,
        \`part\`,
        \`eligible_voters_total\`,
        \`eligible_voters_permanent\`,
        \`eligible_voters_special\`,
        \`present_voters_total\`,
        \`present_voters_permanent\`,
        \`present_voters_special\`,
        \`present_voters_supliment\`,
        \`papers_received\`,
        \`papers_unused\`,
        \`votes_valid\`,
        \`votes_null\`,
        \`present_voters_mail\`
      ) VALUES (
        0,
        ${electionId},
        ${data.CountryId},
        ${data.CountyId},
        ${data.LocalityId},
        ${data.SV},
        0,
        ${data.A_SV},
        ${data.A_SV},
        0,
        ${data.AP_SV},
        ${data.APP_SV},
        ${data.APS_SV},
        0,
        0,
        0,
        ${data.C},
        ${data.D},
        0);
  `);
    recordsData.push({
      has_issues: 0,
      election_id: electionId,
      country_id: data.CountryId,
      county_id: data.CountyId,
      locality_id: data.LocalityId,
      section: data.SV,
      part: 0,
      eligible_voters_total: data.A_SV,
      eligible_voters_permanent: data.A_SV,
      eligible_voters_special: 0,
      present_voters_total: data.AP_SV,
      present_voters_permanent: data.APP_SV,
      present_voters_special: data.B3,
      present_voters_supliment: 0,
      papers_received: data.E,
      papers_unused: data.F,
      votes_valid: data.C,
      votes_null: data.D,
      present_voters_mail: 0,
    });
  }
  return {
    votesInserts,
    votesData,
    turnoutsInserts,
    turnoutsData,
    recordsInserts,
    recordsData,
  };
}

async function processRound1Data() {
  const ROUND_ONE_ID = 32;

  // see citeste_ma_t1.txt
  const candidatesTur1 = [
    { key: "P1", name: "George-Crin-Laurentiu ANTONESCU" },
    { key: "P2", name: "Mircea-Dan GEOANA" },
    { key: "P3", name: "Hunor KELEMEN" },
    { key: "P4", name: "Traian BASESCU" },
    { key: "P5", name: "Sorin-Mircea OPRESCU" },
    { key: "P6", name: "George BECALI" },
    { key: "P7", name: "Ovidiu-Cristian IANE" },
    { key: "P8", name: "Gheorghe-Eduard MANOLE" },
    { key: "P9", name: "Corneliu VADIM-TUDOR" },
    { key: "P10", name: "Remus-Florinel CERNEA" },
    { key: "P11", name: "Constantin-Ninel POTIRCA" },
    { key: "P12", name: "Constantin ROTARU" },
  ];

  const {
    partyInserts: partyInsertsRound1,
    partyVarNames: partyVarNamesRound1,
  } = await getPartiesData(ROUND_ONE_ID, candidatesTur1);

  const {
    candidateInserts: candidateInsertsRound1,
    candidatesVarLookup: candidatesVarLookupRound1,
  } = getCandidatesData(ROUND_ONE_ID, partyVarNamesRound1, candidatesTur1);

  const {
    votesInserts: votesInsertsTur1,
    votesData: votesDataTur1,
    turnoutsInserts: turnoutsInsertsTur1,
    turnoutsData: turnoutsDataTur1,
    recordsInserts: recordsInsertsTur1,
    recordsData: recordsDataTur1,
  } = await parseResults(
    ROUND_ONE_ID,
    "./data/prez_2009/sectii_p_processed.csv",
    candidatesVarLookupRound1
  );

  await fs.writeFile(
    "data/prez_2009/output/round_1_data.sql",
    [
      ...partyInsertsRound1,
      ...candidateInsertsRound1,
      ...votesInsertsTur1,
      ...turnoutsInsertsTur1,
      ...recordsInsertsTur1,
    ].join("\r\n"),
    "utf8"
  );

  await fs.writeFile(
    "data/prez_2009/output/tur_1_votes.csv",
    stringify(votesDataTur1, { header: true }),
    "utf8"
  );
  await fs.writeFile(
    "data/prez_2009/output/tur_1_records.csv",
    stringify(recordsDataTur1, { header: true }),
    "utf8"
  );
  await fs.writeFile(
    "data/prez_2009/output/tur_1_turnouts.csv",
    stringify(turnoutsDataTur1, { header: true }),
    "utf8"
  );
}

async function processRound2Data() {
  const ROUND_TWO_ID = 31;

  // see citeste_ma_t2.txt
  const candidatesTur2 = [
    { key: "P1", name: "Traian BASESCU" },
    { key: "P2", name: "Mircea-Dan GEOANA" },
  ];

  const {
    partyInserts: partyInsertsRound2,
    partyVarNames: partyVarNamesRound2,
  } = await getPartiesData(ROUND_TWO_ID, candidatesTur2);

  const {
    candidateInserts: candidateInsertsRound2,
    candidatesVarLookup: candidatesVarLookupRound2,
  } = getCandidatesData(ROUND_TWO_ID, partyVarNamesRound2, candidatesTur2);

  const {
    votesInserts: votesInsertsTur2,
    votesData: votesDataTur2,
    turnoutsInserts: turnoutsInsertsTur2,
    turnoutsData: turnoutsDataTur2,
    recordsInserts: recordsInsertsTur2,
    recordsData: recordsDataTur2,
  } = await parseResults(
    ROUND_TWO_ID,
    "./data/prez_2009/sectii_tur2_processed.csv",
    candidatesVarLookupRound2
  );

  await fs.writeFile(
    "data/prez_2009/output/round_2_data.sql",
    [
      ...partyInsertsRound2,
      ...candidateInsertsRound2,
      ...votesInsertsTur2,
      ...turnoutsInsertsTur2,
      ...recordsInsertsTur2,
    ].join("\r\n"),
    "utf8"
  );

  await fs.writeFile(
    "data/prez_2009/output/tur_2_votes.csv",
    stringify(votesDataTur2, { header: true }),
    "utf8"
  );
  await fs.writeFile(
    "data/prez_2009/output/tur_2_records.csv",
    stringify(recordsDataTur2, { header: true }),
    "utf8"
  );
  await fs.writeFile(
    "data/prez_2009/output/tur_2_turnouts.csv",
    stringify(turnoutsDataTur2, { header: true }),
    "utf8"
  );
}

async function processElectionData() {
  const start = Date.now();
  await fs.mkdir("data/prez_2009/output", { recursive: true });
  await processRound1Data();
  await processRound2Data();

  const end = Date.now();

  console.log(
    chalk.green(`✅ Precessing completed in ${(end - start) / 1000}s`)
  );

  process.exit(0);
}

processElectionData().catch((err) => {
  console.error(chalk.red("❌ Processing failed"));
  console.error(err);
  process.exit(1);
});
