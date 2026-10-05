import { Link } from 'react-router'
import { ShoppingBasketIcon } from 'lucide-react'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/button'
import { FoodSection } from './FoodSection'

export function FoodPage() {
  return (
    <Page
      title="Food"
      back="/apps"
      actions={
        <Button asChild variant="ghost" size="icon-lg" className="text-primary">
          <Link to="/food/list" aria-label="Shopping list"><ShoppingBasketIcon className="size-5" /></Link>
        </Button>
      }
    >
      <FoodSection />
    </Page>
  )
}
