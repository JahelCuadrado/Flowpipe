/**
  * Pagination token for fetching subsequent pages of results.
  */
export interface Page {
  readonly url: string;
  readonly id?: string;
  readonly ids?: readonly string[];
  readonly cookies?: Readonly<Record<string, string>>;
  readonly body?: string;
}
