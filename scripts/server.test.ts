import assert from "node:assert/strict";
import { test } from "node:test";
import { BastionError } from "./lib/errors.ts";
import { authJvmOpts, parseEnvValue, upPlan, validateAuthServer } from "./server.ts";

test("local `up` recreates the container and forces a modpack resync", () => {
    const p = upPlan("up", true);
    assert.deepEqual(p.args, ["up", "-d", "--force-recreate"]);
    assert.equal(p.forceSync, true);
});

test("`up` with a published pack does not force anything", () => {
    const p = upPlan("up", false);
    assert.deepEqual(p.args, ["up", "-d"]);
    assert.equal(p.forceSync, false);
});

test("`update` always forces recreate and resync", () => {
    for (const local of [true, false]) {
        const p = upPlan("update", local);
        assert.deepEqual(p.args, ["up", "-d", "--force-recreate"]);
        assert.equal(p.forceSync, true);
    }
});

test("parseEnvValue reads one key, ignoring comments, blanks and quotes", () => {
    const text = [
        "# AUTH_SERVER=commented.out",
        "",
        "PLAYIT_SECRET_KEY=secret",
        "  AUTH_SERVER = ely.by  ",
    ].join("\r\n");
    assert.equal(parseEnvValue(text, "AUTH_SERVER"), "ely.by");
    assert.equal(
        parseEnvValue('AUTH_SERVER="https://a.test/api"', "AUTH_SERVER"),
        "https://a.test/api",
    );
    assert.equal(parseEnvValue("AUTH_SERVER='ely.by'", "AUTH_SERVER"), "ely.by");
    assert.equal(parseEnvValue("AUTH_SERVER=", "AUTH_SERVER"), "");
    assert.equal(parseEnvValue("MEMORY=4G", "AUTH_SERVER"), "");
    assert.equal(parseEnvValue("XAUTH_SERVER=bad", "AUTH_SERVER"), "");
});

test("validateAuthServer accepts hostnames and https URLs only", () => {
    for (const ok of ["ely.by", "auth.example.com", "https://auth.example.com/api/yggdrasil"]) {
        assert.equal(validateAuthServer(ok), ok);
    }
    for (const bad of [
        "with space",
        'a"b.com',
        "it's.com",
        "http://insecure.test",
        "ftp://x.test",
        "-javaagent:x",
        "https://",
        "https://a b.test",
        "not_a_host",
    ]) {
        assert.throws(() => validateAuthServer(bad), BastionError, bad);
    }
});

test("authJvmOpts is empty without an auth server and an agent flag with one", () => {
    assert.equal(authJvmOpts(""), "");
    assert.equal(authJvmOpts("ely.by"), "-javaagent:/authlib/authlib-injector.jar=ely.by");
});
