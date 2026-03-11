import {MyComponent} from "@/components/db/test";
import {TestComp} from "@/components/db/testComp";

export default function Home() {
  return (
    <main>
      <h1>Welcome</h1>
      <MyComponent text="Hello" />
      <TestComp />
    </main>
  );
}
