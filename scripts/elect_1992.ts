import chalk from "chalk";
import Papa from "papaparse";
import { promises as fs } from "fs";
import { groupBy } from "lodash-es";
interface CandidatPrezidentiale {
  NR_CRT: number;
  NUME: string;
  PARTID: string;
}

interface PartyDetails {
  COD_PARTID: number;
  DEN_SCURTA: string;
  DEN_LUNG_1: string;
  DEN_LUNG_2: string;
  DEN_LUNG_3: string;
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

function toSqlValue(val: string | number): string {
  return typeof val === "number"
    ? `${val}`
    : `'${val.replace(/'/g, "''").trim()}'`;
}

const ELECTION_ID = 3;
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

async function getPartiesLookup() {
  const partyVarNames = new Map<string, string>();
  const rawPartiesData = await fs.readFile(
    "data/elect_1992/NOMUNIC.csv",
    "utf-8"
  );

  const parsedParties = Papa.parse<PartyDetails>(rawPartiesData, {
    header: true,
    skipEmptyLines: true,
    delimiter: ",",
    dynamicTyping: true,
  });

  const partyInserts = parsedParties.data
    .map((p) => ({
      shortName: p.DEN_SCURTA,
      fullName: [
        p.DEN_LUNG_1.trim(),
        p.DEN_LUNG_2?.trim() ?? "",
        p.DEN_LUNG_3?.trim() ?? "",
      ]
        .join(" ")
        .trim(),
    }))
    .map((party, index) => {
      const varName = `@party_${index}`;
      partyVarNames.set(party.shortName, varName);

      return (
        `INSERT INTO \`rezultatevot\`.\`parties\` (\`name\`, \`acronym\`, \`color\`, \`election_id\`, \`created_at\`, \`updated_at\`)\n` +
        `VALUES (${toSqlValue(party.shortName)}, ${toSqlValue(
          party.fullName
        )}, '${COLOR}', ${ELECTION_ID}, NOW(), NOW());\n` +
        `SET ${varName} = LAST_INSERT_ID();`
      );
    });

  return {
    partyInserts,
    partyVarNames,
  };
}

function getCandidatesLookup(
  partyVarNames: Map<string, string>,
  candidates: CandidatPrezidentiale[]
) {
  const candidatesVarLookup = new Map<string, [string, number]>();

  const candidateInserts = candidates.map((candidat, index) => {
    const varName = `@candidat_${index + 1}`;
    candidatesVarLookup.set(candidat.NUME.trim(), [varName, candidat.NR_CRT]);

    return (
      `INSERT INTO \`rezultatevot\`.\`candidates\`(\`name\`, \`display_name\`, \`color\`, \`election_id\`, \`party_id\`, \`created_at\`, \`updated_at\`)\n` +
      `VALUES (${toSqlValue(candidat.NUME)}, NULL, ${toSqlValue(
        "#808080"
      )}, ${ELECTION_ID}, ${partyVarNames.get(
        candidat.PARTID.trim()
      )}, NOW(), NOW());\n` +
      `SET ${varName} = LAST_INSERT_ID();`
    );
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
  file: string,
  candidatesLookup: Map<string, [string, number]>
) {
  const rawCandidates = await fs.readFile(file, "utf-8");

  const parsedCandidates = Papa.parse<PVData>(rawCandidates, {
    header: true,
    skipEmptyLines: true,
    delimiter: ",",
    dynamicTyping: true,
  });

  const dataPerCounty = Object.entries(
    groupBy(parsedCandidates.data, (r) => r.NR_CIRC)
  ).map(([NR_CIRC, data]) => {
    return {
      countyId: countiesByCircId[+NR_CIRC].id,
      values: data.reduce(
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
  const votesData: {
    election_id: number;
    country_id: number | null;
    county_id: number | null;
    locality_id: number | null;
    section: number;
    part: number;
    votable_type: string;
    votable_id: string;
    votes: number;
  }[] = [];
  for (var countyData of dataPerCounty) {
    for (var [candidate, [varName, ballotPosition]] of candidatesLookup) {
      const votesInsert =
        `INSERT INTO \`rezultatevot\`.\`votes\` (\`election_id\`, \`country_id\`, \`county_id\`, \`locality_id\`, \`section\`, \`part\`, \`votable_type\`, \`votable_id\`, \`votes\`)` +
        `VALUES (${ELECTION_ID}, NULL, ${countyData.countyId}, ${
          localitiesMap[countyData.countyId]
        }, 1, 0, \`candidate\`, ${varName}, ${
          countyData["P" + ballotPosition]
        });`;

      votesInserts.push(votesInsert);
      votesData.push({
        election_id: ELECTION_ID,
        country_id: null,
        county_id: countyData.countyId,
        locality_id: localitiesMap[countyData.countyId],
        part: 0,
        section: 1,
        votable_id: varName,
        votable_type: "candidate",
        votes: countyData["P" + ballotPosition],
      });
    }
  }
  return dataPerCounty;
}

async function processElectionData() {
  const start = Date.now();
  const candidatesTur1 = await parseCandidatesNomenclator(
    "./data/elect_1992/NOM_PRES.csv"
  );

  const { partyInserts, partyVarNames } = await getPartiesLookup();
  const { candidateInserts, candidatesVarLookup } = getCandidatesLookup(
    partyVarNames,
    candidatesTur1
  );

  // Subset of candidatesTur1 no need to generate inserts
  const candidatesTur2 = await parseCandidatesNomenclator(
    "./data/elect_1992/NOM_P2.csv"
  );

  const {} = await parseResults(
    "./data/elect_1992/P1.csv",
    candidatesVarLookup
  );
  const {} = await parseResults(
    "./data/elect_1992/P2.csv",
    candidatesVarLookup
  );
  const end = Date.now();
  console.log(
    chalk.green(`✅ Conversion completed in ${(end - start) / 1000}s`)
  );

  process.exit(0);
}

processElectionData().catch((err) => {
  console.error(chalk.red("❌ Conversion failed"));
  console.error(err);
  process.exit(1);
});
