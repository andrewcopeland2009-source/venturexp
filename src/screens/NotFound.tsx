import { Compass } from 'lucide-react';
import { EmptyState, LinkButton, PageHeader } from '@/components/ui';

export default function NotFound() {
  return (
    <div>
      <PageHeader title="Page not found" back="/" />
      <EmptyState icon={<Compass />} title="This page doesn’t exist" action={<LinkButton to="/">Go home</LinkButton>}>
        The link may be out of date.
      </EmptyState>
    </div>
  );
}
