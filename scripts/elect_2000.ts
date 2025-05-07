import chalk from "chalk";
import { stringify } from "csv-stringify/sync";
import { promises as fs } from "fs";
import Papa from "papaparse";
import { RecordsData, toSqlValue, TurnoutData, VotesData } from "./utils";

interface CandidateDetails {
  CODU: number;
  DENL: string; // Full name
  DENI: string; // Political affiliation or "Candidat independent"
  PRAG: number;
  CODM: number;
  TNC: number;
  CODAL: number;
}

interface PVData {
  NCE: number;
  NUME_CE: string;
  CountyId: number | null;
  LocalityId: number | null;
  CountryId: string | null;
  NSV: number;
  SVSPEC: number;
  ADRESA: string;
  NUME_L: string;
  COD_L: number;
  SIRUTA: number;
  TIP_L: number;
  MEDIU_L: number;
  A_SV: number;
  AP_SV: number;
  APP_SV: number;
  APS_SV: number;
  TVE_SV: number;
  VN_SV: number;
  BVP_SV: number;
  BVRN_SV: number;
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

  // for Round 2 we get them like this
  ILIESCU: number;
  VADIM: number;
}

const COLOR = "#000000";

async function getPartiesData(
  electionId: number,
  candidates: CandidateDetails[]
) {
  const partyVarNames = new Map<string, string>();

  const partyInserts = candidates.map((candidate, index) => {
    const varName = `@party_${index}`;
    partyVarNames.set(candidate.DENI, varName);

    return `INSERT INTO \`rezultatevot\`.\`parties\` (
          \`name\`,
          \`acronym\`,
          \`color\`,
          \`election_id\`,
          \`created_at\`,
          \`updated_at\`
        ) VALUES (
          ${toSqlValue(candidate.DENI)},
          ${toSqlValue(candidate.DENI)},
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
    candidatesVarLookup.set(candidat.DENL.trim(), {
      varName,
      resultsAccessorFn: resultsAccessorFn
        ? resultsAccessorFn
        : (name: string) => `P${candidat.CODU}`,
    });
    const partyVar = partyVarNames.get(candidat.DENI.trim());

    return `INSERT INTO \`rezultatevot\`.\`candidates\`(
        \`name\`,
        \`display_name\`,
        \`color\`,
        \`election_id\`,
        \`party_id\`,
        \`created_at\`,
        \`updated_at\`
      )VALUES (
        ${toSqlValue(candidat.DENL)},
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

async function parseCandidatesNomenclator(file: string) {
  const rawCandidates = await fs.readFile(file, "utf-8");

  const parsedCandidates = Papa.parse<CandidateDetails>(rawCandidates, {
    header: true,
    skipEmptyLines: true,
    delimiter: ",",
    dynamicTyping: true,
  });

  return parsedCandidates.data;
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
          ${data.NSV},
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
        section: data.NSV,
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
      ${data.NSV},
      ${data.A_SV},
      0,
      ${data.APP_SV},
      0,
      ${data.APS_SV},
      0,
      ${data.A_SV},
      ${data.TVE_SV},
      ${((data.TVE_SV / data.A_SV) * 100).toFixed(2)},
      ${data.TIP_L === 0 ? "R" : "U"},
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
      section: data.NSV,
      initial_permanent: data.A_SV,
      initial_complement: 0,
      permanent: data.APP_SV,
      complement: 0,
      supplement: data.APS_SV,
      mobile: 0,
      initial_total: data.A_SV,
      total: data.TVE_SV,
      percent: parseFloat(((data.TVE_SV / data.A_SV) * 100).toFixed(2)),
      area: data.TIP_L === 0 ? "R" : "U",
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
        ${data.NSV},
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
        ${data.TVE_SV},
        ${data.VN_SV},
        0);
  `);
    recordsData.push({
      has_issues: 0,
      election_id: electionId,
      country_id: data.CountryId,
      county_id: data.CountyId,
      locality_id: data.LocalityId,
      section: data.NSV,
      part: 0,
      eligible_voters_total: data.A_SV,
      eligible_voters_permanent: data.A_SV,
      eligible_voters_special: 0,
      present_voters_total: data.AP_SV,
      present_voters_permanent: data.APP_SV,
      present_voters_special: data.APS_SV,
      present_voters_supliment: 0,
      papers_received: 0,
      papers_unused: 0,
      votes_valid: data.TVE_SV,
      votes_null: data.VN_SV,
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
  const ROUND_ONE_ID = 22;

  const candidatesTur1 = await parseCandidatesNomenclator(
    "./data/elect_2000/pres.csv"
  );

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
    "./data/elect_2000/p1_processed.csv",
    candidatesVarLookupRound1
  );

  await fs.writeFile(
    "data/elect_2000/output/round_1_data.sql",
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
    "data/elect_2000/output/tur_1_votes.csv",
    stringify(votesDataTur1, { header: true }),
    "utf8"
  );
  await fs.writeFile(
    "data/elect_2000/output/tur_1_records.csv",
    stringify(recordsDataTur1, { header: true }),
    "utf8"
  );
  await fs.writeFile(
    "data/elect_2000/output/tur_1_turnouts.csv",
    stringify(turnoutsDataTur1, { header: true }),
    "utf8"
  );
}

async function processRound2Data() {
  const ROUND_TWO_ID = 21;

  const candidatesTur2 = await parseCandidatesNomenclator(
    "./data/elect_2000/pres2.csv"
  );

  const {
    partyInserts: partyInsertsRound2,
    partyVarNames: partyVarNamesRound2,
  } = await getPartiesData(ROUND_TWO_ID, candidatesTur2);

  const {
    candidateInserts: candidateInsertsRound2,
    candidatesVarLookup: candidatesVarLookupRound2,
  } = getCandidatesData(
    ROUND_TWO_ID,
    partyVarNamesRound2,
    candidatesTur2,
    (name) => (name === "ION ILIESCU" ? "ILIESCU" : "VADIM")
  );

  const {
    votesInserts: votesInsertsTur2,
    votesData: votesDataTur2,
    turnoutsInserts: turnoutsInsertsTur2,
    turnoutsData: turnoutsDataTur2,
    recordsInserts: recordsInsertsTur2,
    recordsData: recordsDataTur2,
  } = await parseResults(
    ROUND_TWO_ID,
    "./data/elect_2000/p2_processed.csv",
    candidatesVarLookupRound2
  );

  await fs.writeFile(
    "data/elect_2000/output/round_2_data.sql",
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
    "data/elect_2000/output/tur_2_votes.csv",
    stringify(votesDataTur2, { header: true }),
    "utf8"
  );
  await fs.writeFile(
    "data/elect_2000/output/tur_2_records.csv",
    stringify(recordsDataTur2, { header: true }),
    "utf8"
  );
  await fs.writeFile(
    "data/elect_2000/output/tur_2_turnouts.csv",
    stringify(turnoutsDataTur2, { header: true }),
    "utf8"
  );
}

async function processElectionData() {
  const start = Date.now();
  await fs.mkdir("data/elect_2000/output", { recursive: true });
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
