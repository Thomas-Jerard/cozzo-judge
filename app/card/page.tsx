import type { Metadata } from "next";
import { CardView } from "./card-view";

export const metadata: Metadata = {
  title: "Shared scorecard",
  description: "A Cozzo Judge scorecard carried in the link, with no account and no database.",
};

export default function CardPage() {
  return <CardView />;
}
