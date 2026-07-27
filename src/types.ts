/** Region drives which map surface a project renders on. */
export type Region = 'LV' | 'NNV' | 'AZ';

export type ProjectStatus =
  | 'Preconstruction'
  | 'In Progress'
  | 'Closeout'
  | 'Complete';

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
  | 'Design-Build';

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
  status: ProjectStatus;
  /** 0–100. Drives the timeline bar in the detail panel. */
  progress: number;
  /** First two digits of the job number, as a full year. */
  year: number;
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
  status: string; // 'all' | ProjectStatus
}

export interface ViewState {
  /** World-space center of the viewport. */
  cx: number;
  cy: number;
  /** Zoom multiplier on top of the cover-fit base scale. */
  k: number;
}
