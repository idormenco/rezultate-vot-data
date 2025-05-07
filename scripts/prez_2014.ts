import chalk from "chalk";
import { stringify } from "csv-stringify/sync";
import { promises as fs } from "fs";
import Papa from "papaparse";
import { RecordsData, toSqlValue, TurnoutData, VotesData } from "./utils";

interface PVData {
  "Cod Birou Electoral": string;
  Judet: string;
  CountyId: number;
  LocalityId: number;
  CountryId: string | null;
  SV: number;
  Adresa: string;
  Mediu: number;
  Sortare: number;
  Localitate: string;
  SIRUTA: number;
  "Numărul total al alegătorilor înscrişi în listele electorale permanente": number;
  "Numărul total al alegătorilor care s-au prezentat la urne": number;
  "Numărul total al alegătorilor care s-au prezentat la urne, înscrişi în copiile de pe listele electorale permanente": number;
  "Numărul total al alegătorilor care au votat în altă secţie de votare decât cea în care au fost arondaţi conform domiciliului": number;
  "Numărul total al alegătorilor care au votat utilizând urna specială": number;
  "Numărul total al voturilor valabil exprimate": number;
  "Numărul total al voturilor nule": number;
  "Numărul buletinelor de vot primite": number;
  "Numărul buletinelor de vot neîntrebuinţate şi anulate": number;
  "HUNOR KELEMEN": number;
  "KLAUS-WERNER IOHANNIS": number;
  "CRISTIAN-DAN DIACONESCU": number;
  "VICTOR-VIOREL PONTA": number;
  "WILLIAM GABRIEL BRÎNZĂ": number;
  "ELENA-GABRIELA UDREA": number;
  "MIREL-MIRCEA AMARIŢEI": number;
  "TEODOR-VIOREL MELEŞCANU": number;
  "GHEORGHE FUNAR": number;
  "ZSOLT SZILÁGYI": number;
  "MONICA-LUISA MACOVEI": number;
  "CONSTANTIN ROTARU": number;
  "CĂLIN-CONSTANTIN-ANTON POPESCU-TĂRICEANU": number;
  "CORNELIU VADIM-TUDOR": number;
}

const COLOR = "#000000";

async function getPartiesData(electionId: number, candidates: string[]) {
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
          ${toSqlValue(`Party of ${candidate}`)},
          ${toSqlValue(`Party of ${candidate}`)},
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
  candidates: string[]
) {
  const candidatesVarLookup = new Map<
    string,
    { varName: string; resultsAccessorFn: (name: string) => string }
  >();

  const candidateInserts = candidates.map((candidate, index) => {
    const varName = `@candidat_${index + 1}`;
    candidatesVarLookup.set(candidate.trim(), {
      varName,
      resultsAccessorFn: (name: string) => name,
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
        ${toSqlValue(candidate)},
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

  const filteredData = parsedData.data.filter(
    (d) => d["Cod Birou Electoral"] !== "Total"
  );

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
      ${
        data[
          "Numărul total al alegătorilor înscrişi în listele electorale permanente"
        ]
      },
      ${
        data[
          "Numărul total al alegătorilor care au votat în altă secţie de votare decât cea în care au fost arondaţi conform domiciliului"
        ]
      },
      ${data.APP_SV},
      0,
      ${data.APS_SV},
      0,
      ${data.A_SV},
      ${data.TVE_SV},
      ${((data.TVE_SV / data.A_SV) * 100).toFixed(2)},
      ${data.Mediu === 1 ? "U" : "R"},
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
      initial_permanent: data.A_SV,
      initial_complement: 0,
      permanent: data.APP_SV,
      complement: 0,
      supplement: data.APS_SV,
      mobile: 0,
      initial_total: data.A_SV,
      total: data.TVE_SV,
      percent: parseFloat(((data.TVE_SV / data.A_SV) * 100).toFixed(2)),
      area: data.Mediu === 1 ? "U" : "R",
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
        ${data["Numărul total al alegătorilor înscrişi în listele electorale permanente"]},      
        ${data["Numărul total al alegătorilor înscrişi în listele electorale permanente"]},
        0,
        ${data["Numărul total al alegătorilor care s-au prezentat la urne"]},
        ${data["Numărul total al alegătorilor care s-au prezentat la urne, înscrişi în copiile de pe listele electorale permanente"]},
        ${data["Numărul total al alegătorilor care au votat utilizând urna specială"]},
        ${data["Numărul total al alegătorilor care au votat în altă secţie de votare decât cea în care au fost arondaţi conform domiciliului"]},
        ${data["Numărul buletinelor de vot primite"]},
        ${data["Numărul buletinelor de vot neîntrebuinţate şi anulate"]},
        ${data["Numărul total al voturilor valabil exprimate"]},
        ${data["Numărul total al voturilor nule"]},
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
      eligible_voters_total:
        data[
          "Numărul total al alegătorilor înscrişi în listele electorale permanente"
        ],
      eligible_voters_permanent:
        data[
          "Numărul total al alegătorilor înscrişi în listele electorale permanente"
        ],
      eligible_voters_special: 0,
      present_voters_total:
        data["Numărul total al alegătorilor care s-au prezentat la urne"],
      present_voters_permanent:
        data[
          "Numărul total al alegătorilor care s-au prezentat la urne, înscrişi în copiile de pe listele electorale permanente"
        ],
      present_voters_special:
        data[
          "Numărul total al alegătorilor care au votat utilizând urna specială"
        ],
      present_voters_supliment:
        data[
          "Numărul total al alegătorilor care au votat în altă secţie de votare decât cea în care au fost arondaţi conform domiciliului"
        ],
      papers_received: data["Numărul buletinelor de vot primite"],
      papers_unused:
        data["Numărul buletinelor de vot neîntrebuinţate şi anulate"],
      votes_valid: data["Numărul total al voturilor valabil exprimate"],
      votes_null: data["Numărul total al voturilor nule"],
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
  const ROUND_ONE_ID = 64;

  // see data/Alegeri-prezidentiale-2014/Tur 1/SIAP2014_STAT_Statistica-la-nivel-de-sectie-de-votare-tur1.xlsx
  const candidatesTur1 = [
    "HUNOR KELEMEN",
    "KLAUS-WERNER IOHANNIS",
    "CRISTIAN-DAN DIACONESCU",
    "VICTOR-VIOREL PONTA",
    "WILLIAM GABRIEL BRÎNZĂ",
    "ELENA-GABRIELA UDREA",
    "MIREL-MIRCEA AMARIŢEI",
    "TEODOR-VIOREL MELEŞCANU",
    "GHEORGHE FUNAR",
    "ZSOLT SZILÁGYI",
    "MONICA-LUISA MACOVEI",
    "CONSTANTIN ROTARU",
    "CĂLIN-CONSTANTIN-ANTON POPESCU-TĂRICEANU",
    "CORNELIU VADIM-TUDOR",
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
    "./data/Alegeri-prezidentiale-2014/tur1_processed.csv",
    candidatesVarLookupRound1
  );

  await fs.writeFile(
    "data/Alegeri-prezidentiale-2014/output/round_1_data.sql",
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
    "data/Alegeri-prezidentiale-2014/output/tur_1_votes.csv",
    stringify(votesDataTur1, { header: true }),
    "utf8"
  );
  await fs.writeFile(
    "data/Alegeri-prezidentiale-2014/output/tur_1_records.csv",
    stringify(recordsDataTur1, { header: true }),
    "utf8"
  );
  await fs.writeFile(
    "data/Alegeri-prezidentiale-2014/output/tur_1_turnouts.csv",
    stringify(turnoutsDataTur1, { header: true }),
    "utf8"
  );
}

async function processRound2Data() {
  const ROUND_TWO_ID = 63;

  // see data/Alegeri-prezidentiale-2014/Tur 2/SIAP2014_STAT_Statistica-la-nivel-de-sectie-de-votare1.xlsx
  const candidatesTur2 = ["VICTOR-VIOREL PONTA", "KLAUS-WERNER IOHANNIS"];

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
    "./data/Alegeri-prezidentiale-2014/sectii_tur2_processed.csv",
    candidatesVarLookupRound2
  );

  await fs.writeFile(
    "data/Alegeri-prezidentiale-2014/output/round_2_data.sql",
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
    "data/Alegeri-prezidentiale-2014/output/tur_2_votes.csv",
    stringify(votesDataTur2, { header: true }),
    "utf8"
  );
  await fs.writeFile(
    "data/Alegeri-prezidentiale-2014/output/tur_2_records.csv",
    stringify(recordsDataTur2, { header: true }),
    "utf8"
  );
  await fs.writeFile(
    "data/Alegeri-prezidentiale-2014/output/tur_2_turnouts.csv",
    stringify(turnoutsDataTur2, { header: true }),
    "utf8"
  );
}

async function processElectionData() {
  const start = Date.now();
  await fs.mkdir("data/Alegeri-prezidentiale-2014/output", { recursive: true });
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
