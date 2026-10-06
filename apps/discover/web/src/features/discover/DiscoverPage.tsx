import { Page } from '@tars/ui/components/Page'
import { DiscoverSection } from './DiscoverSection'

export function DiscoverPage() {
  return (
    <Page title="Discover" back={false}>
      <DiscoverSection />
    </Page>
  )
}
