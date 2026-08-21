-- Baseline projects commonly grant EXECUTE to PUBLIC. Revoke those inherited
-- grants explicitly so chat RPCs are callable only by their intended roles.
revoke execute on function public.get_or_create_dm(text) from public, anon, authenticated;
revoke execute on function public.get_or_create_system_conversation() from public, anon, authenticated;
revoke execute on function public.get_dm_messaging_status(uuid) from public, anon, authenticated;
revoke execute on function public.chat_conversation_summaries() from public, anon, authenticated;
revoke execute on function public.send_system_message(text, text, text, jsonb) from public, anon, authenticated;

grant execute on function public.get_or_create_dm(text) to authenticated;
grant execute on function public.get_or_create_system_conversation() to authenticated;
grant execute on function public.get_dm_messaging_status(uuid) to authenticated;
grant execute on function public.chat_conversation_summaries() to authenticated;
grant execute on function public.send_system_message(text, text, text, jsonb) to service_role;
