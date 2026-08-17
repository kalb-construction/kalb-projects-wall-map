/** Region drives which map surface a project renders on. */
export type Region = 'LV' | 'NNV' | 'AZ';

export type ProjectStatus =
  | 'Preconstruction'
  | 'In Progress'
  | 'Closeout'
  | 'Coming Soon'
  | 'Complete';

/**
 * Which company built it. Kalb is the default and keeps the red pin; BLAK
 * Development carries its own brand colours (see lib/brand.ts).
 */
export type Developer = 'kalb' | 'blak';

export type Category =
  | 'Retail'
  | 'Restaurant'
  | 'Office & TI'
  | 'Industrial'
  | 'Civic & Housing'
  | 'Medical'
  | 'Tavern & Gaming'
  | 'Automotive & Storage'
  | 'Recreation & Events'
  | 'Civil & Sitework'
  | 'Design-Build';

/** A Kalb project team — drives marker colors and the map legend. */
export interface Team {
  id: string;
  name: string;
  /** Any CSS color; used for the marker, legend swatch, and list dot. */
  color: string;
  note?: string;
}

export interface Project {
  /** Stable id — used for routes (#/project/<id>) and React keys. */
  id: string;
  /** Kalb job number, e.g. "26104". */
  number: string;
  name: string;
  /** Optional short label used on map callouts where space is tight. */
  shortName?: string;
  address: string;
  city: string;
  state: string;
  region: Region;
  /** Approximate coordinates — good enough for the stylized atlas map. */
  lat: number;
  lng: number;
  category: Category;
  /** Verbatim "Project Type" from the PM job list (e.g. "GU Restaurant/Bar"). */
  projectType?: string;
  /** Team id from data/teams.json — the project manager. */
  team?: string;
  /** Superintendent as written on the PM sheet. */
  superintendent?: string | null;
  /** Defaults to 'kalb' when absent. */
  developer?: Developer;
  /** BLAK sheets quote a build duration, e.g. "12 months". */
  duration?: string;
  /** BLAK sheets quote a budget result, e.g. "On budget". */
  budgetOutcome?: string;
  status: ProjectStatus;
  /** 0–100. Only set where it is actually known (finished jobs). */
  progress?: number;
  /** Estimated completion, as written on the PM sheet. */
  estCompletion?: string;
  /** Same date normalised to YYYY-MM-DD, where it could be parsed. */
  estCompletionDate?: string;
  /** Square footage from the PM sheet. */
  sqFt?: number;
  /** Text where a number wasn't available ("Bidding", "Site area"). */
  sqFtNote?: string;
  /** Data-quality notes: missing fields, conflicts, shared pins. */
  flags?: string[];
  /** First two digits of the job number, as a full year (B-jobs omit it). */
  year?: number;
  featured: boolean;
  /**
   * Projects sharing a siteId collapse into one map marker that fans out
   * on touch (e.g. the four Craig & Valley pads, the Palm campus).
   */
  siteId?: string;
  siteName?: string;
  description: string;
  /**
   * Path to an architectural render / hero photo (drop files in
   * public/renders and reference "./renders/<file>.jpg"). When null the
   * atlas generates a procedural isometric building scene instead.
   */
  heroImage: string | null;
  tags?: string[];
}

export interface Filters {
  city: string; // 'all' | city group label
  category: string; // 'all' | Category
  status: string; // 'all' | ProjectStatus (kept for future use)
}
