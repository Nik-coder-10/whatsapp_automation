import { Container } from "@/components/ui/Container";
import { LoadingState } from "@/components/ui/States";

export default function RootLoading() {
  return (
    <Container>
      <LoadingState message="Loading Trolift Solutions…" />
    </Container>
  );
}
