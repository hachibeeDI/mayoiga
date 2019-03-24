# Mayoiga

The React Hook based form library. Of course it is TypeScript friendly.


## Conceptual sample

```

import * as React from 'react';
import {FC} from 'react';

import {useForm, createFormScope} from '../../src/';
import {Input, NumberInput} from '../../src/inputProtocol';

const required = (target: string) => (target.length === 0 ? 'required' : undefined);

const between = (min: number, max: number) => (target: number) => {
  if (target < min) {
    return `more than ${min}`;
  }
  if (target > max) {
    return `less than ${max}`;
  }
};

const choice = function<T>(...candidates: Array<T>) {
  return (target: T) => (candidates.includes(target) ? undefined : 'You should choose from the candidates.');
};

const INITIAL_FORM_STATE = {
  name: '',
  age: 13,
  sex: 'fish',
};

const {context, scope} = createFormScope<typeof INITIAL_FORM_STATE>();

const DemoForm = scope(props => {
  const {Form, Field} = useForm(context);
  return (
    <Form onSubmit={value => console.log(value)}>
      <div>
        <Field name="name" component={Input} validations={[required]} />
      </div>
      <div>
        <Field name="age" component={NumberInput} validations={[between(5, 20)]} />
      </div>
      <div>
        <Field name="sex" component={Input} validations={[choice('fish', 'squid', 'octopus')]} />
      </div>

      <button disabled={!props.touched || Object.values(props.errors).some(e => !!e.length)}>submit</button>
    </Form>
  );
});

export default function DemoApp() {
  return <DemoForm initialState={INITIAL_FORM_STATE} onSubmit={value => alert(`submit ${JSON.stringify(value)}`)} />;
}

```
