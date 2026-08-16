export interface MigratedPost {
  title: string;
  basename: string;
  status: 'Publish';
  publishedAt: string;
  categories: string[];
  oldPath: string;
  sourceUrl: string;
  html: string;
  imageUrls: string[];
  features: string[];
  selectionReasons: string[];
}
