import { Stack, Button, Flex, FormControl, FormLabel, Input, Radio, RadioGroup, useToast, Box, Text, Popover, PopoverTrigger, PopoverContent, PopoverArrow, PopoverCloseButton, PopoverHeader, PopoverBody, Spinner } from '@chakra-ui/react'
import { bqTest } from "bq-core"
import { useEffect, FormEvent, useState } from 'react'
import { useAccount } from "wagmi";
import { fetchSigner } from '@wagmi/core'
import { Certification } from 'types/certifications'
import { DEPLOYED_CONTRACTS, ETHERS_PROVIDER } from 'utils/config';

interface Props {
  className?: string
  item: Certification
}

export function CertificationForm(props: Props) {
  const [test, setTest] = useState<any>();
  const [submitButtonState, setSubmitButtonState] = useState(false);
  const [clickedButton, setClickedButton] = useState<"grade" | "submit" | "">("");

  const { address } = useAccount()

  const toast = useToast()
  const className = props.className ?? ''

  useEffect(() =>  {
    const loadTest = async() => {
      const solveModeTest = await bqTest.solveMode(
        props.item.testId,
        ETHERS_PROVIDER,
        DEPLOYED_CONTRACTS.TesterCreator
      )
      setTest(solveModeTest)
    }
    loadTest()
  }, [])

  function setToast(title: string, description: string, status: "success" | "error" | "info") {
    toast({
      title,
      description,
      status,
      variant: 'solid',
      position: 'bottom',
      isClosable: true,
    })
  }

  function handleGrade(multipleChoiceAnswers: number[]) {
    const grade = test.gradeSolution({
      multipleChoiceAnswers
    })

    if (grade.pass) {
      setToast(
        `You passed this test`, 
        `You obtained ${grade.grade}/100 and can obtain this credential.`, 
        'success'
      )
    } else {
      setToast(
        `You did not pass this test`, 
        `You obtained ${grade.grade}/100 which is below the minimum grade of ${grade.minimumGrade}. You cannot obtain this credential.`, 
        'error'
      )
    }
  }

  async function handleSubmit(multipleChoiceAnswers: number[]) {
    if (!address) {
      setToast(
        'You need to connect your wallet first',
        '',
        'error'
      )
      return
    }

    const isHolder = await test.holdsCredential(address)
    if (isHolder) {
      setToast(
        'You already own this credential',
        '',
        'error'
      )
      return
    }

    const grade = test.gradeSolution({
      multipleChoiceAnswers
    })
    if (!grade.pass) {
      setToast(
        `Your solution does not pass this test`, 
        `You obtained ${grade.grade}/100 which is below the minimum grade of ${grade.minimumGrade}. You cannot obtain this credential.`, 
        'error'
      )
      return
    }

    setSubmitButtonState(true)
    setToast(
      'Generating proof',
      'Hang tight, this might take a while',
      'info'
    )

    const proof = await test.generateSolutionProof({
      recipient: address,
      multipleChoiceAnswers
    })

    setToast(
      'Proof generated!',
      `Approve the transaction to earn your credential`,
      'success'
    )

    const signer = await fetchSigner()
    await test.sendSolutionTransaction( 
      signer,
      proof
    ).then( async (tx: any) => {
      await tx.wait()

      setToast(
        'Congratulations! You obtained this credential',
        '',
        'success'
      )
    }).catch(() => {})

    setSubmitButtonState(false)
  }

  async function handleForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const multipleChoiceAnswers = props.item.questions.map((i) => {
      const elements = event.currentTarget.elements
      const element = elements.namedItem(i.title) as HTMLInputElement
      return i.answers.indexOf(element.value) + 1
    })

    if (clickedButton === "grade") {
      handleGrade(multipleChoiceAnswers)
    } else if (clickedButton === "submit") {
      handleSubmit(multipleChoiceAnswers)
    }
  }

  const TestInformation = () => {
    return (
      test ? 
        <>
          <PopoverArrow />
          <PopoverCloseButton />
          <PopoverHeader>{test.stats.credentialsGained}</PopoverHeader>
          <PopoverBody>{'Credential type: '}
            <Text as='b'>{test.stats.testType === 0 ? ' Open Answer' : test.stats.testType === 100 ? 'Multiple Choice' : 'Mixed'}</Text> 
          </PopoverBody>
          <PopoverBody>{'Minimum grade: '}<Text as='b'>{test.stats.minimumGrade}</Text> </PopoverBody>
          <PopoverBody>{'Number of questions: '}
            <Text as='b'>
              {
                test.stats.testType === 0 ? 
                  test.stats.nQuestions   // open answer
                : 
                  test.stats.testType === 100 ?  
                    props.item.questions.length   // multiple choice
                  : 
                    props.item.questions.length + test.stats.nQuestions  // mixed 
              }
            </Text>
          </PopoverBody>
          <PopoverBody>{'Number of solvers: '}<Text as='b'>{test.stats.solvers}</Text> </PopoverBody>
        </>
      :
        <PopoverBody display='flex' justifyContent='center'>
          <Spinner />
        </PopoverBody>
    )
  }

  return (
    <Box mt='4'>
      <Popover>
        <PopoverTrigger>
          <Button>Test Information</Button>
        </PopoverTrigger>
        <PopoverContent>
          <TestInformation />
        </PopoverContent>
      </Popover>

      <form className={className} onSubmit={handleForm} role="form">
        <section>
          {props.item.questions.map((i, index) => {
            return (
              <FormControl as="fieldset" key={i.title} isRequired my={4}>
                <FormLabel as="legend" fontSize="lg" fontWeight="semibold">
                  {`${index + 1}.`} {i.title}
                </FormLabel>

                {i.answers.length === 0 && <Input name={i.title} placeholder="Enter your answer..." />}

                <RadioGroup name={i.title}>
                  <Flex direction="column">
                    {i.answers.map((a) => {
                      return (
                        <Radio key={a} value={a}>
                          {a}
                        </Radio>
                      )
                    })}
                  </Flex>
                </RadioGroup>
              </FormControl>
            )
          })}

          <Stack spacing={4} direction='row' align='center'> 
            <Button type="submit" onClick={()=>{setClickedButton("grade")}}>Grade</Button>
            <Button type="submit" isLoading={submitButtonState} onClick={()=>{setClickedButton("submit")}}>Submit</Button>
          </Stack>
        </section>
      </form>
    </Box>
  )
}