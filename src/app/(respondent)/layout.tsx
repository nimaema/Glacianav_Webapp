import "@/components/questionnaires/questionnaires.css";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "GlaciaNav Questionnaire",
  robots: { index: false, follow: false },
};
export default function RespondentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main>{children}</main>;
}
