[![Lint Check](https://github.com/hachibeeDI/mayoiga/actions/workflows/checker.yml/badge.svg)](https://github.com/hachibeeDI/mayoiga/actions/workflows/checker.yml)

# Mayoiga

Fully typed form state management system for React.

No magic, ref free. It's built for complicated form state management.

## Feature

Support strong typed form state.
Every form should have two kind of types:

1. form state before validation
2. state after validation succeed

i.e. before validation, a field named "bio" might be nullable (`{bio: null | string}`) but it must not empty to submit (`{bio: zod.string().nonempty()}`).

Also considers:

- No ref, DOM free
- High performance, high tuning possibility
  - Mayoiga uses "external state and selector" pattern. You can built your own form if you known what you would like to

## Features does not support

- Short coding

It's not a library for short coding or copy and paste template.


### Quickstart

```typeScript

const schema = zod.object({
  name: zod.string(),
  age: zod
    .string()
    .transform((val) => Number(val))
    .refine((val) => (Number.isNaN(val) ? 0 : val)),
  marked: zod.literal(true),
});

type BeforeValidation = {
  name: string;
  age: string;
  marked: boolean;
};

const {
  components: {Field, Slicer},
  handleSubmit,
} = createFormHook({name:'test', age: '42', marked: false} as BeforeValidation, schema);

function App() {
  const submitHandler = handleSubmit((e) => (result) => {
    if (result.error) {
      return alert('Err!');
    }
    console.log(result.data); /*
      {
        name: 'test',
        age: 42, <- age is typed "number" before validation because of definition
        marked: true, <- have to be "true", not as boolean. it's power of zod
      }
    */
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Field name="name">{(tool) => <input {...tool} />}</Field>
      <Field name="age">{(tool) => <input {...tool} />}</Field>
      <Field name="marked">{(tool) => <input {...tool} />}</Field>
      <input type="submit" />
    </form>
  );
}

```
