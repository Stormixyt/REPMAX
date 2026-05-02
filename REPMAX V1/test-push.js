;(async () => {
  const res = await fetch("https://hqwnyzmipumhhqmvdzus.supabase.co/functions/v1/send-push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      record: {
        chat_id: "test",
        sender_id: "test",
        content: "hello",
        type: "text"
      }
    })
  });
  console.log(res.status, await res.text());
})();
