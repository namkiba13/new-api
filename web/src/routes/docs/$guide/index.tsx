/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { createFileRoute, notFound } from '@tanstack/react-router'

import { getDocsGuide } from '@/features/docs/data'
import { DocsGuidePage } from '@/features/docs/guide'

export const Route = createFileRoute('/docs/$guide/')({
  component: GuideRoute,
})

function GuideRoute() {
  const { guide: slug } = Route.useParams()
  const guide = getDocsGuide(slug)
  if (!guide) throw notFound()
  return <DocsGuidePage guide={guide} />
}
