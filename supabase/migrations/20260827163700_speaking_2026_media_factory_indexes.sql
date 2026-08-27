create index if not exists speaking_test_sections_visual_asset_idx
  on public.speaking_test_sections(visual_asset_id)
  where visual_asset_id is not null;
