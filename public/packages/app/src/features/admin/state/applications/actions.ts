import api, { ApiQueryParams } from "../../../../core/lib/api";
import { applicationsLoaded } from "./reducers";
import { ThunkResult } from "@store/types";
import { IProject, ApiResponse } from "@traceo/types";

export const loadServerApplications = (query?: ApiQueryParams): ThunkResult<void> => {
  return async (dispatch) => {
    if (!query?.sortBy) {
      query = {
        sortBy: "createdAt",
        order: "DESC"
      };
    }
    const { data } = await api.get<ApiResponse<IProject[]>>(
      "/api/applications/search",
      query
    );
    dispatch(applicationsLoaded(data));
  };
};
