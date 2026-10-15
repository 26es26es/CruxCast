import { gsap } from 'gsap'
import { Fragment, useLayoutEffect, useRef } from 'react'

// Letters float up into place, like the ScrollFloat titles on sinankarasu.com,
// but played once on mount instead of tied to scrolling.
export function FloatTitle({ text }: { text: string }) {
  const ref = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    const heading = ref.current
    if (!heading || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const tween = gsap.fromTo(
      heading.querySelectorAll('.char'),
      { opacity: 0, yPercent: 120, scaleY: 2.3, scaleX: 0.7, transformOrigin: '50% 0%' },
      {
        opacity: 1,
        yPercent: 0,
        scaleY: 1,
        scaleX: 1,
        duration: 0.9,
        ease: 'back.inOut(2)',
        stagger: 0.025,
      },
    )
    return () => {
      tween.kill()
    }
  }, [text])

  const words = text.split(' ')
  return (
    <h1 ref={ref} className="float-title" aria-label={text}>
      {words.map((word, wordIndex) => (
        <Fragment key={wordIndex}>
          <span className="word" aria-hidden="true">
            {[...word].map((char, charIndex) => (
              <span key={charIndex} className="char">
                {char}
              </span>
            ))}
          </span>
          {wordIndex < words.length - 1 && ' '}
        </Fragment>
      ))}
    </h1>
  )
}
