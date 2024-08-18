# Cloudflare Worker `email-subaddressing`

_A [Cloudflare email worker][cf-email#workers] providing configurable [email
subaddressing][wiki-ea#sa] (o.k.a. [subaddress extension][rfc-5233] [RFC 5233];
a.k.a. detailed addressing, plus addresses, tagged addresses, mail extension,
etc.)_

[cf-email#workers]: https://developers.cloudflare.com/email-routing/email-workers/
[rfc-5233]: https://datatracker.ietf.org/doc/html/rfc5233
[wiki-ea#sa]: https://en.wikipedia.org/wiki/Email_address#Sub-addressing

## Overview

[Cloudflare Email Routing does not support subaddressing][cf-community-346812]
and [treats `+` as a normal character][cf-email#signs]. [Cloudflare recommends
a catch-all solution][cf-blog-migrating#gmail], but that only works for a single
recipient and exposes the destination address to potential spam. This email
worker enables configuring the catch-all solution to limit users for which email
is accepted, control how it is delivered, and selectively respond to failures.

[cf-blog-migrating#gmail]: https://blog.cloudflare.com/migrating-to-cloudflare-email-routing/#gmail-address-conventions
[cf-community-346812]: https://community.cloudflare.com/t/support-plus-addressing-in-email-routing/346812
[cf-email#signs]: https://developers.cloudflare.com/email-routing/postmaster/#signs-such--and--are-treated-as-normal-characters-for-custom-addresses

### Features

* limits users for which email is accepted
* limits subaddresses for which email is accepted (globally or per user)
* fails with a message or fail-forwards to a destination address (globally or
  per user)
* adds email header for filtering forwarded messages in destination email client 
* allows customized subaddress separator
* supports KV for unlimited[*](#limitations) user-to-destination combinations
  (with global fallbacks)

### Limitations

1. **Cloudflare only forwards to verified destination addresses!**

2. Email workers introduce limits that may not otherwise exist with [built-in,
   one-to-one routes (rules)][cf-email#routing].

   Cloudflare Email Routing [limits routes (rules) and destination
   addresses][cf-email#rules]. But [KV allows unlimited keys per
   namespace][cf-workers#kv-limits], which theoretically provides a workaround
   to these limitations. However, [workers have request
   limits][cf-workers#limits] (on the free tier) and [KV has read
   limits][cf-workers#kv-limits], among others (also on the free tier).

[cf-email#rules]: https://developers.cloudflare.com/email-routing/limits/#rules-and-addresses
[cf-email#routing]: https://developers.cloudflare.com/email-routing/setup/email-routing-addresses/
[cf-workers#kv-limits]: https://developers.cloudflare.com/workers/platform/limits/#kv-limits
[cf-workers#limits]: https://developers.cloudflare.com/workers/platform/limits/#worker-limits

## Instructions

> [!CAUTION]\
> The default configuration rejects all email, effectively disabling email
> routing! [Configure](#configure) at least one user and destination to ensure
> email delivery.

### Install

1. Log in to [the Cloudflare dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages**
3. Click the **Create** button
4. Click the **Create Worker** button
5. Give the worker a **Name**\
   **HINT:** Multiple email domains may require multiple email workers. A name
   like `email-subaddressing` works for a single email domain or a single
   configuration shared across multiple domains, but a domain-oriented name like
   `domain-com-email` or `at-domain-com` is better suited for per-domain
   configurations.
6. Click the **Deploy** button
7. Click the **Edit code** button
8. Replace the existing code in the already-opened `worker.js` tab with [the
   contents of the worker script](worker.js)
9. Click the **Deploy** button
10. Click the **Save and deploy** button on the confirmation
11. Click the link above the `worker.js` tab (with the same name from step five)
12. [Configure](#configure) environment variables for scenarios involving
    one-or-few users and one destination address.\
    OR\
    [Create a KV](#create-a-kv) for scenarios involving few-or-many users or
    more than one destination address.

#### Create a KV

1. Navigate to **Workers & Pages**
2. Select **KV**
3. Click the **Create a namespace** button
4. Give the KV a **Namespace Name**\
   **HINT:** KV names are only relevant when viewing the list of KVs and when
   binding the KV to an email worker. All KVs should be bound to the email
   worker as `MAP`, so the KV name itself is less important.
5. Click the **Add** button

### Configure

Given the email addresses user@domain.com and user+subaddress@domain.com with a
forwarding destination of any﻿@email.com and a fail behavior of either 1) reject
with message or 2) fail-forward to any+spam﻿@email.com ...

> [!TIP]\
> Environment variables are configured in the worker's settings (Workers &
> Pages > _worker_ > Settings > Variables > **Add variable** under **Environment
> Variables**). KVs are configured directly (Workers & Pages > KV > **View** in
> _kv_'s row) and bound (as `MAP`) to workers (Workers & Pages > _worker_ >
> Settings > Variables > **Add binding** under **KV Namespace Bindings**)

#### _Required:_ set users for which email will be accepted

1. as the value of the `USERS` environment variable\
   OR
2. as one of several comma-separated users in the `USERS` environment variable\
   OR
3. as the value of the `@USERS` key in the `MAP`-bound KV\
   OR
4. as one of several comma-separated users in the `@USERS` key in the `MAP`-
   bound KV\
   OR
5. as a key in the `MAP`-bound KV

> [!NOTE]\
> Setting the `USERS` environment variable to `*` accepts email for all users
> (subject to `SUBADDRESSES` restrictions).

#### _Optional:_ set subaddresses for which email will be accepted

1. as comma-separated values in the `SUBADDRESSES` environment variable
   (applied to all users)\
   OR
2. as comma-separated values in the `@SUBADDRESSES` key in the `MAP`-bound KV
   (applied to all users)\
   OR
3. as comma-separated values in the `user+` key in the `MAP`-bound KV
   (applies only to user)

> [!NOTE]\
> Setting shared values (i.e. options 1 and 2) to `*` (the default) accepts
> email with any subaddress (subject to `USERS` restrictions).

#### _Required:_ set destination to which accepted emails will be forwarded

1. as the value of the `DESTINATION` environment variable
   (applied to all users)\
   OR
2. as the value of the `@DESTINATION` key in the `MAP`-bound KV
   (applied to all users)\
   OR
3. as the value of the user's key in the `MAP`-bound KV
   (applies only to user)

> [!TIP]\
> Setting shared values (i.e. options 1 and 2) to a domain (e.g. @domain.com)
> enables multi-user destinations (accepted emails will be forwarded to the same
> user at the specified domain).

#### _Optional:_ set the fail behavior for "rejected" emails

1. as the value of the `FAILURE` environment variable
   (applied to all users)\
   OR
2. as the value of the `@FAILURE` key in the `MAP`-bound KV
   (applied to all users)\
   OR
3. as the second, comma-separated value of the user's key in the `MAP`-bound KV
   (applies only to user)

> [!TIP]\
> Setting shared values (i.e. options 1 and 2) to a subaddress and domain (e.g.
> +spam﻿@domain.com) enables multi-user failure destinations (rejected emails
> will be fail-forwarded to the same user at the specified domain with the
> specified subaddress).

### Enable

Configure a [catch-all address][cf-email#catch-all] to use the newly
[installed](#install) and [configured](#configure) worker. From [the Cloudflare
dashboard](https://dash.cloudflare.com/) ...

1. Select the website for which email should be received
2. Navigate to **Email**
3. Click the **Routing rules** tab
4. Set the **Action** field to "Send to a Worker"
5. Set the **Destination** field to the name of the worker from
   [installation](#install) step five
6. Click the **Disabled**-labeled switch to enable catch-all

[cf-email#catch-all]: https://developers.cloudflare.com/email-routing/setup/email-routing-addresses/#catch-all-address

## Contributions

Contributions are welcome and are not limited to pull requests. Feel free to
[open an issue](/issues/new) or [start a discussion](/discussions/new).

## License

All works herein are licensed under [MIT](LICENSE).


[cf-workers#wrangler]: https://developers.cloudflare.com/workers/wrangler/
[deploy]: https://deploy.workers.cloudflare.com/?url=https://github.com/jeremy-harnois/cloudflare-worker-email-subaddressing

[cf-workers#env-vars]: https://developers.cloudflare.com/workers/configuration/environment-variables/#add-environment-variables-via-the-dashboard
[cf-workers#ref-kv]: https://developers.cloudflare.com/workers/runtime-apis/kv/#reference-kv-from-workers
