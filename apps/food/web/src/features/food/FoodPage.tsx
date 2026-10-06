import { Link } from 'react-router'
import { ShoppingBasketIcon } from 'lucide-react'
import { Page } from '@tars/ui/components/Page'
import { Button } from '@tars/ui/components/ui/button'
import { FoodSection } from './FoodSection'

export function FoodPage() {
  return (
    <Page
      title="Food"
      back={false}
      actions={
        <Button asChild variant="ghost" size="icon-lg" className="text-primary">
          <Link to="/list" aria-label="Shopping list"><ShoppingBasketIcon className="size-5" /></Link>
        </Button>
      }
    >
      <FoodSection />
    </Page>
  )
}
