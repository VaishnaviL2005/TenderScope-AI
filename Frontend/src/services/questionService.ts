import { api } from "./api";

export const askQuestion = (tenderId: string, question: string) => api.askQuestion(tenderId, question);
