import chalk from "chalk";
import { promises as fs } from "fs";
import { groupBy } from "lodash-es";
import Papa from "papaparse";
import { RecordsData, toSqlValue, TurnoutData, VotesData } from "./utils";
import { stringify } from "csv-stringify/sync";

interface CandidatPrezidentiale {
  NR_CRT: number;
  NUME: string;
  PARTID: string;
}

interface PVData {
  NR_CIRC: number;
  SECTIE: number;
  NR_CAS: number;
  A: number;
  AP: number;
  APP: number;
  APS: number;
  TVE: number;
  VN: number;
  P1: number;
  P2: number;
  P3: number;
  P4: number;
  P5: number;
  P6: number;
}

const COLOR = "#000000";
const countiesByCircId: Record<
  number,
  { id: number; code: string; name: string }
> = {
  1: { id: 10, code: "AB", name: "Alba" },
  2: { id: 29, code: "AR", name: "Arad" },
  3: { id: 38, code: "AG", name: "Argeș" },
  4: { id: 47, code: "BC", name: "Bacău" },
  5: { id: 56, code: "BH", name: "Bihor" },
  6: { id: 65, code: "BN", name: "Bistrița-Năsăud" },
  7: { id: 74, code: "BT", name: "Botoșani" },
  8: { id: 83, code: "BV", name: "Brașov" },
  9: { id: 92, code: "BR", name: "Brăila" },
  10: { id: 109, code: "BZ", name: "Buzău" },
  11: { id: 118, code: "CS", name: "Caraș-Severin" },
  12: { id: 519, code: "CL", name: "Călărași" },
  13: { id: 127, code: "CJ", name: "Cluj" },
  14: { id: 136, code: "CT", name: "Constanța" },
  15: { id: 145, code: "CV", name: "Covasna" },
  16: { id: 154, code: "DB", name: "Dâmbovița" },
  17: { id: 163, code: "DJ", name: "Dolj" },
  18: { id: 172, code: "GL", name: "Galați" },
  19: { id: 528, code: "GR", name: "Giurgiu" },
  20: { id: 181, code: "GJ", name: "Gorj" },
  21: { id: 190, code: "HR", name: "Harghita" },
  22: { id: 207, code: "HD", name: "Hunedoara" },
  23: { id: 216, code: "IL", name: "Ialomița" },
  24: { id: 225, code: "IS", name: "Iași" },
  25: { id: 243, code: "MM", name: "Maramureș" },
  26: { id: 252, code: "MH", name: "Mehedinți" },
  27: { id: 261, code: "MS", name: "Mureș" },
  28: { id: 270, code: "NT", name: "Neamț" },
  29: { id: 289, code: "OT", name: "Olt" },
  30: { id: 298, code: "PH", name: "Prahova" },
  31: { id: 305, code: "SM", name: "Satu Mare" },
  32: { id: 314, code: "SJ", name: "Sălaj" },
  33: { id: 323, code: "SB", name: "Sibiu" },
  34: { id: 332, code: "SV", name: "Suceava" },
  35: { id: 341, code: "TR", name: "Teleorman" },
  36: { id: 350, code: "TM", name: "Timiș" },
  37: { id: 369, code: "TL", name: "Tulcea" },
  38: { id: 378, code: "VS", name: "Vaslui" },
  39: { id: 387, code: "VL", name: "Vâlcea" },
  40: { id: 396, code: "VN", name: "Vrancea" },
  41: { id: 403, code: "B", name: "București" },
  42: { id: 234, code: "IF", name: "Ilfov" },
};

const localitiesMap = {
  10: 180092, //name: "Judetul Alba" },
  29: 180093, //name: "Judetul Arad" },
  38: 180094, //name: "Judetul Argeș" },
  47: 180095, //name: "Judetul Bacău" },
  56: 180096, //name: "Judetul Bihor" },
  65: 180097, //name: "Judetul Bistrița-Năsăud" },
  74: 180098, //name: "Judetul Botoșani" },
  83: 180099, //name: "Judetul Brașov" },
  92: 180100, //name: "Judetul Brăila" },
  109: 180101, //name: "Judetul Buzău" },
  118: 180102, //name: "Judetul Caraș-Severin" },
  519: 180103, //name: "Judetul Călărași" },
  127: 180104, //name: "Judetul Cluj" },
  136: 180105, //name: "Judetul Constanța" },
  145: 180106, //name: "Judetul Covasna" },
  154: 180107, //name: "Judetul Dâmbovița" },
  163: 180108, //name: "Judetul Dolj" },
  172: 180109, //name: "Judetul Galați" },
  528: 180110, //name: "Judetul Giurgiu" },
  181: 180111, //name: "Judetul Gorj" },
  190: 180112, //name: "Judetul Harghita" },
  207: 180113, //name: "Judetul Hunedoara" },
  216: 180114, //name: "Judetul Ialomița" },
  225: 180115, //name: "Judetul Iași" },
  243: 180116, //name: "Judetul Maramureș" },
  252: 180117, //name: "Judetul Mehedinți" },
  261: 180118, //name: "Judetul Mureș" },
  270: 180119, //name: "Judetul Neamț" },
  289: 180120, //name: "Judetul Olt" },
  298: 180121, //name: "Judetul Prahova" },
  305: 180122, //name: "Judetul Satu Mare" },
  314: 180123, //name: "Judetul Sălaj" },
  323: 180124, //name: "Judetul Sibiu" },
  332: 180125, //name: "Judetul Suceava" },
  341: 180126, //name: "Judetul Teleorman" },
  350: 180127, //name: "Judetul Timiș" },
  369: 180128, //name: "Judetul Tulcea" },
  378: 180129, //name: "Judetul Vaslui" },
  387: 180130, //name: "Judetul Vâlcea" },
  396: 180131, //name: "Judetul Vrancea" },
  403: 180132, //name: "Judetul București" },
  234: 180133, //name: "Judetul Ilfov" },
};

async function getPartiesLookup(
  electionId: number,
  candidates: CandidatPrezidentiale[]
) {
  const partyVarNames = new Map<string, string>();

  const partyInserts = candidates.map((party, index) => {
    const varName = `@party_${index}`;
    partyVarNames.set(party.PARTID, varName);

    return `INSERT INTO \`rezultatevot\`.\`parties\` (
          \`name\`,
          \`acronym\`,
          \`color\`,
          \`election_id\`,
          \`created_at\`,
          \`updated_at\`
        ) VALUES (
          ${toSqlValue(party.PARTID)},
          ${toSqlValue(party.PARTID)},
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

function getCandidatesLookup(
  electionId: number,
  partyVarNames: Map<string, string>,
  candidates: CandidatPrezidentiale[]
) {
  const candidatesVarLookup = new Map<
    string,
    { varName: string; resultsAccessorFn: (name: string) => string }
  >();

  const candidateInserts = candidates.map((candidat, index) => {
    const varName = `@candidat_${index + 1}`;
    candidatesVarLookup.set(candidat.NUME.trim(), {
      varName,
      resultsAccessorFn: () => `P${candidat.NR_CRT}`,
    });
    const partyVar = partyVarNames.get(candidat.PARTID.trim());

    return `INSERT INTO \`rezultatevot\`.\`candidates\`(
        \`name\`,
        \`display_name\`,
        \`color\`,
        \`election_id\`,
        \`party_id\`,
        \`created_at\`,
        \`updated_at\`
      )VALUES (
        ${toSqlValue(candidat.NUME)},
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

  const parsedCandidates = Papa.parse<CandidatPrezidentiale>(rawCandidates, {
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

  const parsedRawData = Papa.parse<PVData>(rawData, {
    header: true,
    skipEmptyLines: true,
    delimiter: ",",
    dynamicTyping: true,
  });

  const dataPerCounty = Object.entries(
    groupBy(parsedRawData.data, (r) => r.NR_CIRC)
  ).map(([NR_CIRC, data]) => {
    return {
      countyId: countiesByCircId[+NR_CIRC].id,
      ...data.reduce(
        (prev, acc) => {
          return {
            A: acc.A + prev.A,
            AP: acc.AP + prev.AP,
            APP: acc.APP + prev.APP,
            APS: acc.APS + prev.APS,
            TVE: acc.TVE + prev.TVE,
            VN: acc.VN + prev.VN,
            P1: acc.P1 + prev.P1,
            P2: acc.P2 + prev.P2,
            P3: acc.P3 + prev.P3,
            P4: acc.P4 + prev.P4,
            P5: acc.P5 + prev.P5,
            P6: acc.P6 + prev.P6,
          };
        },
        {
          A: 0,
          AP: 0,
          APP: 0,
          APS: 0,
          TVE: 0,
          VN: 0,
          P1: 0,
          P2: 0,
          P3: 0,
          P4: 0,
          P5: 0,
          P6: 0,
        }
      ),
    };
  });

  const votesInserts: string[] = [];
  const votesData: VotesData[] = [];

  const turnoutsInserts: string[] = [];
  const turnoutsData: TurnoutData[] = [];

  const recordsInserts: string[] = [];
  const recordsData: RecordsData[] = [];

  for (var countyData of dataPerCounty) {
    const localityId = localitiesMap[countyData.countyId];
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
          NULL,
          ${countyData.countyId},
          ${localityId},
          1,
          0,
          \`candidate\`,
          ${varName},
          ${countyData[resultsAccessorFn(candidate)]});`;

      votesInserts.push(votesInsert);
      votesData.push({
        election_id: electionId,
        country_id: null,
        county_id: countyData.countyId,
        locality_id: localityId,
        part: 0,
        section: 1,
        votable_id: varName,
        votable_type: "candidate",
        votes: countyData[resultsAccessorFn(candidate)],
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
      NULL,
      ${countyData.countyId},
      ${localityId},
      1,
      ${countyData.A},
      0,
      ${countyData.APP},
      0,
      ${countyData.APS},
      0,
      ${countyData.A},
      ${countyData.TVE},
      ${((countyData.TVE / countyData.A) * 100).toFixed(2)},
      'U',
      0, 0, 0, 0, 0,
      0, 0, 0, 0, 0
    );`;

    turnoutsInserts.push(turnoutsInsert);
    turnoutsData.push({
      has_issues: 1,
      election_id: electionId,
      country_id: null,
      county_id: countyData.countyId,
      locality_id: localityId,
      section: 1,
      initial_permanent: countyData.A,
      initial_complement: 0,
      permanent: countyData.APP,
      complement: 0,
      supplement: countyData.APS,
      mobile: 0,
      initial_total: countyData.A,
      total: countyData.TVE,
      percent: parseFloat(((countyData.TVE / countyData.A) * 100).toFixed(2)),
      area: "U",
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
        NULL,
        ${countyData.countyId},
        ${localityId},
        1,
        0,
        ${countyData.A},
        ${countyData.A},
        0,
        ${countyData.AP},
        ${countyData.APP},
        ${countyData.APS},
        0,
        0,
        0,
        ${countyData.TVE},
        ${countyData.VN},
        0);
  `);
    recordsData.push({
      has_issues: 0,
      election_id: electionId,
      country_id: null,
      county_id: countyData.countyId,
      locality_id: localityId,
      section: 1,
      part: 0,
      eligible_voters_total: countyData.A,
      eligible_voters_permanent: countyData.A,
      eligible_voters_special: 0,
      present_voters_total: countyData.AP,
      present_voters_permanent: countyData.APP,
      present_voters_special: countyData.APS,
      present_voters_supliment: 0,
      papers_received: 0,
      papers_unused: 0,
      votes_valid: countyData.TVE,
      votes_null: countyData.VN,
      present_voters_mail: 0,
    });
  }
  return {
    dataPerCounty,
    votesInserts,
    votesData,
    turnoutsInserts,
    turnoutsData,
    recordsInserts,
    recordsData,
  };
}

async function processTur1Data() {
  const ROUND_ONE_ID = 3;

  const candidatesTur1 = await parseCandidatesNomenclator(
    "./data/elect_1992/NOM_PRES.csv"
  );

  const {
    partyInserts: partyInsertsRound1,
    partyVarNames: partyVarNamesRound1,
  } = await getPartiesLookup(ROUND_ONE_ID, candidatesTur1);

  const {
    candidateInserts: candidateInsertsRound1,
    candidatesVarLookup: candidatesVarLookupRound1,
  } = getCandidatesLookup(ROUND_ONE_ID, partyVarNamesRound1, candidatesTur1);

  const {
    dataPerCounty: dataPerCountyTur1,
    votesInserts: votesInsertsTur1,
    votesData: votesDataTur1,
    turnoutsInserts: turnoutsInsertsTur1,
    turnoutsData: turnoutsDataTur1,
    recordsInserts: recordsInsertsTur1,
    recordsData: recordsDataTur1,
  } = await parseResults(
    ROUND_ONE_ID,
    "./data/elect_1992/P1.csv",
    candidatesVarLookupRound1
  );

  await fs.writeFile(
    "data/elect_1992/output/round_1_data.sql",
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
    "data/elect_1992/output/tur_1_data.csv",
    stringify(dataPerCountyTur1, { header: true }),
    "utf8"
  );
  await fs.writeFile(
    "data/elect_1992/output/tur_1_votes.csv",
    stringify(votesDataTur1, { header: true }),
    "utf8"
  );
  await fs.writeFile(
    "data/elect_1992/output/tur_1_records.csv",
    stringify(recordsDataTur1, { header: true }),
    "utf8"
  );
  await fs.writeFile(
    "data/elect_1992/output/tur_1_turnouts.csv",
    stringify(turnoutsDataTur1, { header: true }),
    "utf8"
  );
}

async function processTur2Data() {
  const ROUND_TWO_ID = 2;

  const candidatesTur2 = await parseCandidatesNomenclator(
    "./data/elect_1992/NOM_P2.csv"
  );

  const {
    partyInserts: partyInsertsRound2,
    partyVarNames: partyVarNamesRound2,
  } = await getPartiesLookup(ROUND_TWO_ID, candidatesTur2);

  const {
    candidateInserts: candidateInsertsRound2,
    candidatesVarLookup: candidatesVarLookupRound2,
  } = getCandidatesLookup(ROUND_TWO_ID, partyVarNamesRound2, candidatesTur2);

  const {
    dataPerCounty: dataPerCountyTur2,
    votesInserts: votesInsertsTur2,
    votesData: votesDataTur2,
    turnoutsInserts: turnoutsInsertsTur2,
    turnoutsData: turnoutsDataTur2,
    recordsInserts: recordsInsertsTur2,
    recordsData: recordsDataTur2,
  } = await parseResults(
    ROUND_TWO_ID,
    "./data/elect_1992/P2.csv",
    candidatesVarLookupRound2
  );

  await fs.writeFile(
    "data/elect_1992/output/round_2_data.sql",
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
    "data/elect_1992/output/tur_2_data.csv",
    stringify(dataPerCountyTur2, { header: true }),
    "utf8"
  );
  await fs.writeFile(
    "data/elect_1992/output/tur_2_votes.csv",
    stringify(votesDataTur2, { header: true }),
    "utf8"
  );
  await fs.writeFile(
    "data/elect_1992/output/tur_2_records.csv",
    stringify(recordsDataTur2, { header: true }),
    "utf8"
  );
  await fs.writeFile(
    "data/elect_1992/output/tur_2_turnouts.csv",
    stringify(turnoutsDataTur2, { header: true }),
    "utf8"
  );
}

async function processElectionData() {
  const start = Date.now();
  await fs.mkdir("data/elect_1992/output");

  await processTur1Data();
  await processTur2Data();

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
