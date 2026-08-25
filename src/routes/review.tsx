import { createFileRoute } from "@tanstack/react-router";
import { ReviewWorkspace } from "./interpreted";

export const Route = createFileRoute("/review")({ component: ReviewWorkspace });
