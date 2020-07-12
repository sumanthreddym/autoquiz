import ForgeUI, {
  render,
  useConfig,
  Fragment,
  Text,
  Macro,
  useAction,
  useState,
  Button,
  RadioGroup,
  Radio,
  Form,
  ButtonSet,
  useProductContext,
} from "@forge/ui";
import api from "@forge/api";

const QUIZ_URL = "https://d1fzd9muw39rgw.cloudfront.net";

const App = () => {
  const { contentId } = useProductContext();
  const [data] = useAction(
    () => null,
    async () => await getContent(contentId)
  );

  var jsonObj = JSON.parse(data.body.atlas_doc_format.value);
  var text = getValues(jsonObj, "text").join(" ");

  let [isStarted, setIsStarted] = useState(false);

  let [questions, setQuestions] = useAction(
    async () => await getQuestions(text),
    ""
  );

  return (
    <Fragment>
      <Text content="**AutoQuiz**" format="markdown" />
      {questions ? (
        <Quiz questions={questions} />
      ) : (
        <Text
          content={"Click the **Start Quiz** button below to Start AutoQuiz"}
        />
      )}
      {isStarted ? (
        <Text content="" />
      ) : (
        <Button
          text="Start Quiz"
          onClick={() => {
            setQuestions();
            setIsStarted(true);
          }}
        />
      )}
    </Fragment>
  );
};

const getContent = async (contentId) => {
  const response = await api
    .asApp()
    .requestConfluence(
      `/wiki/rest/api/content/${contentId}?expand=body.atlas_doc_format`
    );

  if (!response.ok) {
    const err = `Error while getContent with contentId ${contentId}: ${response.status} ${response.statusText}`;
    console.error(err);
    throw new Error(err);
  }
  return await response.json();
};

function getValues(obj, key) {
  var objects = [];
  for (var i in obj) {
    if (!obj.hasOwnProperty(i)) continue;
    if (typeof obj[i] == "object") {
      objects = objects.concat(getValues(obj[i], key));
    } else if (i == key) {
      objects.push(obj[i]);
    }
  }
  return objects;
}

const getQuestions = async (data) => {
  data = {
    text: data,
    url: "",
  };

  let opts = {};
  opts = Object.assign({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  const response = await api.fetch(QUIZ_URL, opts);

  if (!response.ok) {
    const err = `Error invoking ${QUIZ_URL} (Slack): ${response.status} ${response.statusText}`;
    throw new Error(err);
  }
  const responseBody = await response.json();
  return responseBody.quiz;
};

function Quiz({ questions }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [answers, setAnswers] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState("");

  const question = questions[currentQuestion];

  const renderError = () => {
    if (!error) {
      return;
    }
    return <Text content={error} />;
  };

  const renderResultsData = () => {
    let totalCorrect = 0;
    let isCorrect = false;
    return answers.map((answer, index) => {
      const question = questions.find(
        (question) => question.id === answer.questionId
      );
      totalCorrect += (isCorrect =
        question.correctIndex === answer.answer.charCodeAt(0) - 97)
        ? 1
        : 0;
      return (
        <Fragment>
          <Text
            content={`${index + 1}. ${question.question} - ${
              isCorrect
                ? `***Correct***. Your Answer: *${
                    question.answers[question.correctIndex]
                  }*`
                : `***Wrong***. Your Answer: *${
                    question.answers[answer.answer.charCodeAt(0) - 97]
                  }*. Correct Answer: *${
                    question.answers[question.correctIndex]
                  }*`
            }`}
          />
          {index == questions.length - 1 ? (
            <Fragment>
              <Text
                content={`***You answered ${totalCorrect} questions correctly out of ${questions.length}***.`}
              />
              <Text
                content={`**Final Score: ${
                  (totalCorrect * 100) / questions.length
                }**%`}
              />
            </Fragment>
          ) : (
            <Text content="" />
          )}
        </Fragment>
      );
    });
  };
  const restart = () => {
    setAnswers([]);
    setCurrentAnswer("");
    setCurrentQuestion(0);
    setShowResults(false);
  };

  const next = () => {
    const answer = { questionId: question.id, answer: currentAnswer };
    if (!currentAnswer) {
      setError("Please Select an option");
      return;
    }

    answers.push(answer);
    setAnswers(answers);
    setCurrentAnswer("");
    if (currentQuestion + 1 < questions.length) {
      setCurrentQuestion(currentQuestion + 1);
      return;
    }
    setShowResults(true);
  };

  if (showResults) {
    return (
      <Fragment>
        <Text content={"**Results**"} />
        <Fragment>{renderResultsData()}</Fragment>
        <Button text="Restart" onClick={restart} />
      </Fragment>
    );
  } else {
    return (
      <Fragment>
        <Text
          content={`*Question* **${currentQuestion + 1}** *of* **${
            questions.length
          }**`}
        />
        <Text content={question.question} />
        {renderError()}
        <Fragment>
          <Form
            onSubmit={(formData) => {
              setCurrentAnswer(formData.selectedAnswer);
              setError("");
            }}
            submitButtonText="Save Answer"
          >
            <RadioGroup
              name="selectedAnswer"
              label="Pick an option and then click Save Answer button to save your answer"
            >
              <Radio label={`${question.answers[0]}`} value="a" />
              <Radio label={`${question.answers[1]}`} value="b" />
              <Radio label={`${question.answers[2]}`} value="c" />
              <Radio label={`${question.answers[3]}`} value="d" />
            </RadioGroup>
          </Form>
          {currentAnswer && (
            <Text
              content={`Saved your answer option - **${
                question.answers[currentAnswer.charCodeAt(0) - 97]
              }**. Click ***Next*** button to continue to the next question`}
            />
          )}
        </Fragment>
        <ButtonSet>
          <Button
            text="Next"
            onClick={next}
            disabled={!currentAnswer ? true : false}
          />
          <Button text="Restart" onClick={restart} />
        </ButtonSet>
      </Fragment>
    );
  }
}

export const run = render(<Macro app={<App />} />);
