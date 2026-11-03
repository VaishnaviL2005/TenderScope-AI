import { api, ApiError } from "./api";

export interface RequirementsResult {
  /** false when GET /requirements does not exist (404/405); the report's extracted_requirements is used instead. */
  available: boolean;
  data: unknown;
}

export async function getRequirements(id: string): Promise<RequirementsResult> {
  try {
    const res = await api.getRequirements(id);
    return { available: true, data: res.data };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) return { available: false, data: undefined };
    throw e;
  }
}

export const getReport = (id: string) => api.getReport(id);
