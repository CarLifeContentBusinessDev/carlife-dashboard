export interface Program {
  id: number;
  title: string;
  subtitle: string;
  img_url: string;
  type: string;
  category_id: number;
  broadcasting_id: number;
  language: string[];
  is_sequential: boolean;
  is_active: boolean;
  is_searchable: boolean;
}

export interface Episode {
  id: number;
  title: string;
  img_url: string;
  program_id: number;
  date: string;
  durtaion: string;
  audio_file: string;
  audioFile_dubbing: string;
  language: string[];
  programs?: { title: string };
  is_active: boolean;
  is_searchable: boolean;
  theme_color?: string;
  sub_title?: string;
}

export interface Series {
  id: string;
  title: string;
  subtitle: string;
  img_url: string;
  section_id: number;
  order: number;
  oem_key: string;
  language: string[];
}

export interface Theme {
  id: string;
  title: string;
  subtitle: string;
  img_url: string;
  section_id: number;
  order: number;
  language: string[];
}

export interface Category {
  id: number;
  title: string;
  img_url: string;
  order: number;
  created_at: string;
  language: string[];
  en_title?: string;
  en_img_url?: string;
  de_title?: string;
  de_img_url?: string;
  jp_title?: string;
  jp_img_url?: string;
}

export interface Broadcasting {
  id: number;
  title: string;
  channel: string;
  frequency: string;
  img_url: string;
  order: number;
  created_at: string;
  language: string[];
}
