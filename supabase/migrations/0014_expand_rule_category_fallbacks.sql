-- Extend owner-approved automatic category fallbacks without replacing staff-selected categories.
-- Existing rule-managed and unassigned models receive the same outcome as future POS imports.
with resolved as (
  select
    product.id,
    case
      when upper(btrim(product.cleaned_code)) ~ '^(ZS|ZL)([[:space:]-]|[0-9]|$)' then 'tops'
      when upper(btrim(product.cleaned_code)) ~ '^(SK|SJ|WJ|FJ|JJ)([[:space:]-]|[0-9]|$)' then 'jeans'
      when upper(btrim(product.cleaned_code)) ~ '^SP([[:space:]-]|[0-9]|$)' then 'shorts'
      when upper(btrim(product.cleaned_code)) ~ '^LP([[:space:]-]|[0-9]|$)' then 'pants'
      when upper(btrim(product.cleaned_code)) ~ '^HD([[:space:]-]|[0-9]|$)' then 'tops'
      when upper(btrim(product.cleaned_code)) ~ '^[A-Z0-9[:space:]-]+$'
        and upper(btrim(product.cleaned_code)) ~ '[0-9]' then 'tops'
      else null
    end as category_slug
  from public.products as product
  where coalesce(product.category_source, 'unassigned') <> 'manual'
)
update public.products as product
   set category_id = category.id,
       category_source = 'rule',
       review_status = 'clean'
  from resolved
  join public.categories as category on category.slug = resolved.category_slug
 where product.id = resolved.id
   and resolved.category_slug is not null
   and (
     product.category_id is distinct from category.id
     or product.category_source is distinct from 'rule'
     or product.review_status is distinct from 'clean'
   );
