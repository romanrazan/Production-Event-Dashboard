import axios from "axios";
import { ZodError } from "zod";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api",
  timeout: 10_000,
  headers: { "Content-Type": "application/json" },
});

export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.code === "ECONNABORTED") return "The production API timed out";
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join("; ");
    if (typeof message === "string") return message;
    if (!error.response) return "Cannot reach the production API";
    return `API request failed (${error.response.status})`;
  }
  if (error instanceof ZodError) return "The API returned an unexpected response shape";
  return error instanceof Error ? error.message : "Unexpected request failure";
}
