export type LocalizedString = {
  en: string;
  ar: string;
};

export type BackgroundType = 'image' | 'video' | 'slider' | 'color';

export interface HeroConfig {
  background_type: BackgroundType;
  media_url?: string | null;
  slider_images?: string[];
  title: LocalizedString;
  subtitle: LocalizedString;
  button_text?: LocalizedString;
  button_link?: string;
}

export interface NavLink {
  id: string;
  label: LocalizedString;
  href: string;
  is_external?: boolean;
}

export interface NavbarConfig {
  logo_url?: string | null;
  links: NavLink[];
}

export interface FooterColumn {
  id: string;
  title: LocalizedString;
  links: NavLink[];
}

export interface FooterConfig {
  tagline?: LocalizedString;
  description?: LocalizedString;
  legal_company_name?: LocalizedString;
  columns: FooterColumn[];
  social_links?: {
    id?: string;
    platform: 'facebook' | 'twitter' | 'instagram' | 'linkedin' | 'youtube' | 'tiktok' | 'other';
    url: string;
    icon?: string;
    image_url?: string;
    className?: string;
  }[];
  bottom_links?: NavLink[];
  copyright_text?: LocalizedString;
}

export interface BannerConfig {
  id: string;
  text: LocalizedString;
  preset: 'primary' | 'destructive' | 'muted' | 'custom';
  advanced_classes?: string;
  icon?: string;
  link?: string;
  is_closable: boolean;
  is_active: boolean;
  display_rule?: {
    type: 'all' | 'include' | 'exclude';
    paths: string;
  };
}

export interface SiteSettings {
  id: number;
  hero_config: HeroConfig;
  navbar_config: NavbarConfig;
  footer_config: FooterConfig;
  banners_config: BannerConfig[];
  updated_at: string;
  updated_by: string | null;
}
