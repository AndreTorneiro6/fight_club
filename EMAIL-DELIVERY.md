# Email deliverability — 19 October 2026

Read-only checks of the production configuration found:

- SMTP submission: send.one.com, port 587. Authentication and required TLS verified successfully; no message sent.
- Sender and SMTP account share the domain atlasapp.pt.
- Both authoritative nameservers (ns01.one.com and ns02.one.com) return no SPF TXT record at atlasapp.pt.
- _dmarc.atlasapp.pt publishes `v=DMARC1; p=reject`.
- Incoming mail MX points to smtp.google.com. Preserve this record.

Missing SPF is a confirmed authentication configuration problem and a likely contributor to spam placement. It does not prove why a particular recipient filtered a message: DKIM may still pass and align. Inspect the received message's Authentication-Results and DKIM-Signature before concluding DKIM is missing. one.com normally handles signing for its hosted mail.

## DNS correction (requires access to the domain's one.com DNS panel)

Add ONE TXT record at the root of atlasapp.pt (host @, or blank as required by the panel):

```
v=spf1 include:_custspf.one.com include:_spf.google.com ~all
```

This authorizes the app's current one.com SMTP service and Google sending. Google is included to accommodate the domain's existing Google mail setup; confirm the intended outbound services with the domain owner. Do not add a second SPF record if another administrator has already created one. Merge authorized services into the existing record instead. Do not replace MX or weaken the DMARC policy for this change.

After DNS propagation, verify the TXT record against both authoritative nameservers. For a new message, inspect the recipient's original message headers for spf=pass, dkim=pass and dmarc=pass, and confirm alignment with atlasapp.pt. If DKIM fails, use the selector in DKIM-Signature to check the exact provider-issued DNS record. Never guess DKIM key values.

The notification code now lets Nodemailer generate Message-ID using the sender domain, replacing the unrelated fightclub.notifications suffix. This is message hygiene; it does not repair SPF or guarantee inbox placement.

References:
- https://help.one.com/hc/en-us/articles/115005595945-Add-an-SPF-record
- https://help.one.com/hc/en-us/articles/17038200070545-Why-do-my-emails-end-up-in-spam-when-using-external-name-servers
- https://help.one.com/hc/en-us/articles/37404026110609-Can-I-use-DKIM-for-my-one-com-email-accounts
- https://support.google.com/mail/answer/81126
