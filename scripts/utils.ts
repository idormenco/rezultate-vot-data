export interface TurnoutData {
  has_issues: number;
  election_id: number;
  country_id: string | null;
  county_id: number | null;
  locality_id: number | null;
  section: number;
  initial_permanent: number;
  initial_complement: number;
  permanent: number;
  complement: number;
  supplement: number;
  mobile: number;
  initial_total: number;
  total: number;
  percent: number;
  area: "U" | "R"; // Assuming 'U' for urban, 'R' for rural
  men_18_24: number;
  men_25_34: number;
  men_35_44: number;
  men_45_64: number;
  men_65: number;
  women_18_24: number;
  women_25_34: number;
  women_35_44: number;
  women_45_64: number;
  women_65: number;
}

export interface VotesData {
  election_id: number;
  country_id: string | null;
  county_id: number | null;
  locality_id: number | null;
  section: number;
  part: number;
  votable_type: string;
  votable_id: string;
  votes: number;
}

export interface RecordsData {
  has_issues: number;
  election_id: number;
  country_id: string | null;
  county_id: number | null;
  locality_id: number | null;
  section: number;
  part: number;
  eligible_voters_total: number;
  eligible_voters_permanent: number;
  eligible_voters_special: number;
  present_voters_total: number;
  present_voters_permanent: number;
  present_voters_special: number;
  present_voters_supliment: number;
  papers_received: number;
  papers_unused: number;
  votes_valid: number;
  votes_null: number;
  present_voters_mail: number;
}

export function toSqlValue(val: string | number | null): string | null {
  if (val === null) return null;
  return typeof val === "number"
    ? `${val}`
    : `'${val.replace(/'/g, "''").trim()}'`;
}
