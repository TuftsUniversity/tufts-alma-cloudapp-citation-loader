// cloudapp/src/app/models/parsed-citation.model.ts

export type CreatorRole =
  | 'author'
  | 'editor'
  | 'translator'
  | 'contributor'
  | 'director'
  | 'unknown';

export type ParsedCitationType =
  | 'book'
  | 'article'
  | 'chapter'
  | 'video'
  | 'report'
  | 'webpage'
  | 'thesis'
  | 'conference'
  | 'unknown';

  export interface ParsedCreator {
  given: string;          // First or given name(s)
  family: string;         // Last or family name
  role: CreatorRole;      // Role in the citation
  literal?: string;       // Original unparsed name (optional)
}

export interface ParsedCitation {
  // Original citation text
  raw: string;

  // Citation classification
  type: ParsedCitationType;

  // Core bibliographic fields
  title: string;
  containerTitle?: string;      // Journal or book title
  publisher?: string;
  publicationPlace?: string;
  year?: string;
  edition?: string;

  // Article-specific fields
  volume?: string;
  issue?: string;
  pages?: string;

  // Identifiers
  doi?: string;
  isbn?: string;
  issn?: string;
  url?: string;

  // Creators (authors, editors, etc.)
  creators: ParsedCreator[];

  // Parsing diagnostics
  parseWarnings: string[];
  confidence?: number | null;

  // Course metadata for Alma integration
  courseName: string;
  instructor: string;
  courseNumber: string;
  courseSemester: string;
  courseTermForMapping?: string;
  courseYearForMapping?: string;

  // Optional UI/helper fields
  needsReview?: boolean;
  allAuthors?: string;
  allEditors?: string;
}

