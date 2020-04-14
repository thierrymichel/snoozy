# @snoozy

| HTML                  | Target  | Sources         | Nb  | Src | Srcset |
| --------------------- | ------- | --------------- | --- | --- | ------ |
| iframe                | iframe  | []              | 0   | 1   | 0      |
| video                 | video   | []              | 0   | 1   | 0      |
| video + source        | video   | [ source ]      | 1+  | 1+  | 0      |
| img[src]              | img     | [ img ]         | 1   | 1   | 0      |
| img[srcset]           | img     | [ img ]         | 1   | 1   | 1      |
| picture + img         | picture | [ img ]         | 1   | 1   | 0+     |
| picture+ img + source | picture | [ img, source ] | 2+  | 1   | 1+     |
