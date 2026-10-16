import type {
  Scenario,
  Simulation,
  SimulationRequest,
  Identity,
  History,
  Plan,
  Progression,
  Draft,
} from "./types";

let csrf = "";
export const setCsrf = (token: string) => {
  csrf = token;
};
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  let response: Response;
  const headers = new Headers(options?.headers);
  if (options?.method && options.method !== "GET") {
    headers.set("Content-Type", "application/json");
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "Não foi possível conectar ao sistema. Verifique a conexão e tente novamente.",
    );
  }
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    const detail =
      typeof error?.detail === "string"
        ? error.detail
        : response.status === 422
          ? "Dados inválidos. Confira os campos e os pré-requisitos do plano."
          : "Não foi possível carregar ou gravar os dados. Tente novamente.";
    if (
      response.status === 401 &&
      path !== "/auth/login" &&
      path !== "/auth/me"
    ) {
      window.dispatchEvent(new Event("session-expired"));
    }
    throw new ApiError(detail, response.status);
  }
  return response.json() as Promise<T>;
}
const body = (method: string, data?: unknown) => ({
  method,
  body: data === undefined ? undefined : JSON.stringify(data),
});
export const getScenarios = () => request<Scenario[]>("/scenarios");
export const simulate = (payload: SimulationRequest) =>
  request<Simulation>("/simulations", body("POST", payload));
export const getMe = () => request<Identity>("/auth/me");
export const login = (email: string, password: string) =>
  request<Identity>("/auth/login", body("POST", { email, password }));
export const logout = () => request("/auth/logout", body("POST"));
export const getHistory = () => request<History>("/me/history");
export const getProgression = () => request<Progression>("/me/progression");
export const getPlans = () => request<Plan[]>("/plans");
export const getPlan = (id: string) => request<Plan>(`/plans/${id}`);
export const createPlan = (name: string, target_term: string) =>
  request<Plan>("/plans", body("POST", { name, target_term }));
export const evaluatePlan = (id: string, draft: Draft) =>
  request<Progression>(`/plans/${id}/simulations`, body("POST", draft));
export const savePlan = (plan: Plan) =>
  request<Plan>(
    `/plans/${plan.id}`,
    body("PUT", {
      name: plan.name,
      target_term: plan.target_term,
      version: plan.version,
      history_revision: plan.history_revision,
      planned_ids: plan.planned_ids,
      hypothetical_ids: plan.hypothetical_ids,
    }),
  );
export const deletePlan = (id: string, version: number) =>
  request(`/plans/${id}?version=${version}`, body("DELETE"));
