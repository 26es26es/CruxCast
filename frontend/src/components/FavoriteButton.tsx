import { useTranslation } from 'react-i18next'
import { StarIcon } from './icons'

type Props = {
  active: boolean
  onToggle: () => void
}

export function FavoriteButton({ active, onToggle }: Props) {
  const { t } = useTranslation()
  const label = active ? t('detail.unfavorite') : t('detail.favorite')
  return (
    <button
      type="button"
      className="favorite-button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onToggle}
    >
      <StarIcon filled={active} />
    </button>
  )
}
