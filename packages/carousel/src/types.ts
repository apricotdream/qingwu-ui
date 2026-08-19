export interface CarouselItem {
  value?: string;
  image: string;
  background?: string;
  thumbnail?: string;
  alt?: string;
  title: string;
  subtitle?: string;
  description?: string;
  eyebrow?: string;
  href?: string;
  linkLabel?: string;
}

export interface CarouselOptions {
  items?: CarouselItem[];
  value?: string | null;
  defaultValue?: string | null;
  className?: string;
  autoplay?: boolean;
  interval?: number;
  /** 播放速度倍率，实际间隔 = interval / speed，下限 250ms */
  speed?: number;
  loop?: boolean;
  showArrows?: boolean;
  showThumbs?: boolean;
  ariaLabel?: string;
  onChange?: (value: string, item: CarouselItem, index: number) => void;
}
