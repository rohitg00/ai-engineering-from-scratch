async def test_one_user_cannot_read_another_users_thread_or_memory(client):
    alice, bob = client("alice"), client("bob")
    thread = await alice.thread()
    await alice.say(thread, "Remember that my door code is 4471")
    await alice.say(thread, "Where is my order ORD-alice-1?")

    assert (await bob.http.get(f"/threads/{thread}/state")).status_code == 404
    assert (await bob.http.post(f"/threads/{thread}/runs", json={"message": "hi"})).status_code == 404
    assert (await bob.http.post(f"/threads/{thread}/approve", json={"decision": "approve"})).status_code == 404

    assert (await bob.http.get("/memories")).json()["memories"] == []
    bob_thread = await bob.thread()
    await bob.say(bob_thread, "What do you remember about me?")
    assert "4471" not in str(await bob.state(bob_thread))

    assert "4471" in str((await alice.http.get("/memories")).json())
    assert (await alice.http.get(f"/threads/{thread}/state")).status_code == 200


async def test_missing_or_wrong_token_is_rejected(app):
    import httpx

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as anon:
        assert (await anon.post("/threads")).status_code == 401
        assert (await anon.post("/threads", headers={"Authorization": "Bearer nope"})).status_code == 401
