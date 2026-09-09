Inspect or edit one record while keeping the queue behind it — risk review, webhook payload, case detail, quick edit.

```jsx
<Drawer open={open} onClose={close} title="Order #EG-2291-4471" subtitle="ord_9Kd2p · COD"
  footer={<><Button variant="ghost" onClick={close}>Close</Button><Button variant="danger-outline">Reject order</Button><Button variant="primary">Approve</Button></>}>
  <RiskScore score={82} reasons={reasons} />
  <KeyValue items={orderFacts} />
</Drawer>
```

Slides in from the inline end, so it comes from the right in LTR and the left in RTL automatically.
