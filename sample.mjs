export const sample = {
  "ttl": 5,
  "initial": "v1",
  "events": [
    {
      "at": 0,
      "action": "read"
    },
    {
      "at": 1,
      "action": "write",
      "value": "v2"
    },
    {
      "at": 2,
      "action": "read"
    },
    {
      "at": 5,
      "action": "read"
    }
  ]
};
