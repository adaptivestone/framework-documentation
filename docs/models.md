---
sidebar_position: 3
---

# Models

TODO mongoose es6, static methods, class methods

#### 1.3.0

Models now support optional callback that will executed on connection ready. If mongo already connected then callback will be executed immediately


[NEW] Add Sequence. It provide ability to easily generate sequences for given types. It save to use on distributed environments

```javascript
const SequenceModel = this.app.getModel('Sequence');
// will be 1
const someTypeSequence = await SequenceModel.getSequence('someType');
// will be 2
const someTypeSequence2 = await SequenceModel.getSequence('someType');
// will be 1 as type is another
const someAnotherTypeSequence = await SequenceModel.getSequence(
  'someAnotherType',
);
```

