import { AnalysisDetail } from '@/components/AnalysisDetail';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div id="main-content">
      <AnalysisDetail id={id} />
    </div>
  );
}
