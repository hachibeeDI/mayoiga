import React from 'react';

export function extractEventValue(e: React.FormEvent) {
  const target: any = e.currentTarget || e.target;
  if (target === null) {
    return;
  }
  const {name, checked, dataset} = target;
  let {type, value} = target;
  if (dataset && dataset.type) {
    type = dataset.type;
  }

  let retValue: any = value;
  if (type === 'number') {
    retValue = parseInt(value, 10);
  } else if (type === 'boolean') {
    retValue = value === 'true';
  } else if (type === 'checkbox') {
    retValue = checked;
  }
  return {name, value: retValue, type, target};
}

export function toTargetProp(value: any, type?: string, dataType?: string, domValue?: string) {
  if (type === 'checkbox') {
    if (dataType === 'check-list') {
      return {value: domValue, checked: (value || []).includes(domValue)};
    } else {
      return {value: domValue, checked: value};
    }
  }
  if (type === 'radio') {
    return {value: domValue, checked: value === domValue};
  }
  return {value: (value || '').toString()};
}
